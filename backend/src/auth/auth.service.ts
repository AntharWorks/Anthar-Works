import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  /**
   * Phase 0 stub: generates and stores the OTP. Dispatch via MSG91 (SMS) /
   * WhatsApp template is wired in through the notifications queue in Phase 4.
   * In development the OTP is returned in the response for testing.
   */
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
