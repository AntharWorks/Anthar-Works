import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { NotificationChannel } from '@prisma/client';
import { createHash, randomInt } from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  private hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  // In development (no MSG91 keys) the OTP is also returned in the response.
  async requestOtp(phone: string) {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      throw new NotFoundException('No account registered with this number');
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
    const payload = { sub: user.id, phone: user.phone, role: user.role };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: { id: user.id, name: user.name, role: user.role },
    };
  }
}
