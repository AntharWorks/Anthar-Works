import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { NotificationChannel, Role, User, UserStatus } from '@prisma/client';
import {
  createHash,
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual,
} from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_HOURLY_CAP = 5;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  // Emails that are granted ADMIN on registration (the super-admin allowlist).
  private superAdminEmails(): string[] {
    return (
      this.config.get<string>('SUPER_ADMIN_EMAILS') ?? 'roshan.manuel@gmail.com'
    )
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }

  // salt:derivedKey using scrypt — no external dependency.
  private hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const derived = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${derived}`;
  }

  private verifyPassword(password: string, stored: string): boolean {
    const [salt, key] = stored.split(':');
    if (!salt || !key) return false;
    const derived = scryptSync(password, salt, 64);
    const keyBuf = Buffer.from(key, 'hex');
    return keyBuf.length === derived.length && timingSafeEqual(keyBuf, derived);
  }

  // Email + password sign-up. Super-admin emails become ADMIN; everyone else
  // registers as a CUSTOMER (with a customer profile).
  async register(input: { name: string; email: string; password: string }) {
    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }
    const role = this.superAdminEmails().includes(email)
      ? Role.ADMIN
      : Role.CUSTOMER;
    const passwordHash = this.hashPassword(input.password);

    if (role === Role.CUSTOMER) {
      const count = await this.prisma.customer.count();
      const customerNo = `AW-${String(count + 1).padStart(6, '0')}`;
      const user = await this.prisma.user.create({
        data: {
          email,
          name: input.name,
          role,
          passwordHash,
          customer: { create: { customerNo } },
        },
      });
      return this.issueTokenPair(user);
    }

    const user = await this.prisma.user.create({
      data: { email, name: input.name, role, passwordHash },
    });
    return this.issueTokenPair(user);
  }

  async loginWithPassword(input: { email: string; password: string }) {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (
      !user ||
      !user.passwordHash ||
      !this.verifyPassword(input.password, user.passwordHash)
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('This account is not active');
    }
    return this.issueTokenPair(user);
  }

  // In development (no MSG91 keys) the OTP is also returned in the response.
  async requestOtp(phone: string) {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      throw new NotFoundException('No account registered with this number');
    }

    // Abuse protection: resend cooldown + rolling hourly cap per phone.
    const lastAttempt = await this.prisma.otpAttempt.findFirst({
      where: { phone },
      orderBy: { createdAt: 'desc' },
    });
    if (lastAttempt) {
      const elapsed = Date.now() - lastAttempt.createdAt.getTime();
      if (elapsed < OTP_RESEND_COOLDOWN_MS) {
        throw new BadRequestException(
          `Please wait ${Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000)}s before requesting another OTP`,
        );
      }
    }
    const lastHourCount = await this.prisma.otpAttempt.count({
      where: { phone, createdAt: { gte: new Date(Date.now() - 3600 * 1000) } },
    });
    if (lastHourCount >= OTP_HOURLY_CAP) {
      throw new BadRequestException(
        'Too many OTP requests — please try again in an hour',
      );
    }

    const code = randomInt(100000, 999999).toString();
    const ttl = Number(this.config.get('OTP_TTL_SECONDS', 300));
    await this.prisma.otpAttempt.create({
      data: {
        phone,
        codeHash: this.hash(code),
        expiresAt: new Date(Date.now() + ttl * 1000),
      },
    });

    await this.notifications.send({
      recipient: phone,
      channel: NotificationChannel.SMS,
      template: 'APP_LOGIN_OTP',
      message: `${code} is your Anthar Works login OTP. Valid for ${Math.round(ttl / 60)} minutes.`,
      payload: { kind: 'otp' },
    });

    const isDev = this.config.get('NODE_ENV') !== 'production';
    return { sent: true, ...(isDev ? { devOtp: code } : {}) };
  }

  async verifyOtp(phone: string, code: string) {
    const maxAttempts = Number(this.config.get('OTP_MAX_ATTEMPTS', 5));
    const attempt = await this.prisma.otpAttempt.findFirst({
      where: { phone, verified: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!attempt || attempt.attempts >= maxAttempts) {
      throw new UnauthorizedException('OTP expired or too many attempts');
    }

    if (attempt.codeHash !== this.hash(code)) {
      await this.prisma.otpAttempt.update({
        where: { id: attempt.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Invalid OTP');
    }

    await this.prisma.otpAttempt.update({
      where: { id: attempt.id },
      data: { verified: true },
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { phone },
    });
    return this.issueTokenPair(user);
  }

  // Rotating refresh: each token is single-use; using it revokes it and
  // issues a fresh pair.
  async refresh(refreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(refreshToken) },
      include: { user: true },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokenPair(stored.user);
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hash(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { loggedOut: true };
  }

  private async issueTokenPair(user: User) {
    const refreshToken = randomBytes(48).toString('hex');
    const ttlDays = parseInt(this.config.get('JWT_REFRESH_TTL', '30d'), 10) || 30;
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hash(refreshToken),
        expiresAt: new Date(Date.now() + ttlDays * 24 * 3600 * 1000),
      },
    });

    const payload = { sub: user.id, phone: user.phone, role: user.role };
    return {
      accessToken: await this.jwt.signAsync(payload),
      refreshToken,
      user: { id: user.id, name: user.name, role: user.role },
    };
  }
}
