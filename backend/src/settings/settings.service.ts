import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

const SINGLETON_ID = 'singleton';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // Reads (creating on first access) the singleton settings row. The initial
  // value of onlinePaymentsEnabled comes from PAYMENTS_ENABLED (default true).
  async getSettings(): Promise<{ onlinePaymentsEnabled: boolean }> {
    const envDefault = this.config.get<string>('PAYMENTS_ENABLED') !== 'false';
    const row = await this.prisma.appConfig.upsert({
      where: { id: SINGLETON_ID },
      update: {},
      create: { id: SINGLETON_ID, onlinePaymentsEnabled: envDefault },
    });
    return { onlinePaymentsEnabled: row.onlinePaymentsEnabled };
  }

  // True when Razorpay keys are present — mirrors RazorpayService.isConfigured
  // without creating a module dependency on PaymentsModule.
  get paymentsConfigured(): boolean {
    return Boolean(
      this.config.get<string>('RAZORPAY_KEY_ID') &&
        this.config.get<string>('RAZORPAY_KEY_SECRET'),
    );
  }

  async update(input: {
    onlinePaymentsEnabled: boolean;
  }): Promise<{ onlinePaymentsEnabled: boolean }> {
    const row = await this.prisma.appConfig.upsert({
      where: { id: SINGLETON_ID },
      update: { onlinePaymentsEnabled: input.onlinePaymentsEnabled },
      create: {
        id: SINGLETON_ID,
        onlinePaymentsEnabled: input.onlinePaymentsEnabled,
      },
    });
    return { onlinePaymentsEnabled: row.onlinePaymentsEnabled };
  }
}
