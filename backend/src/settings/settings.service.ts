import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

const SINGLETON_ID = 'singleton';
const CACHE_TTL_MS = 15_000;

export type AppSettings = {
  onlinePaymentsEnabled: boolean;
  whatsappEnabled: boolean;
  smsEnabled: boolean;
};

@Injectable()
export class SettingsService {
  // Settings change rarely but are read on every notification, so cache them
  // briefly to keep that path off the database.
  private cache: AppSettings | null = null;
  private cachedAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private envDefault(name: string): boolean {
    return this.config.get<string>(name) !== 'false';
  }

  // Reads (creating on first access) the singleton settings row. Each flag's
  // initial value comes from its env var (default true).
  async getSettings(): Promise<AppSettings> {
    if (this.cache && Date.now() - this.cachedAt < CACHE_TTL_MS) {
      return this.cache;
    }
    const row = await this.prisma.appConfig.upsert({
      where: { id: SINGLETON_ID },
      update: {},
      create: {
        id: SINGLETON_ID,
        onlinePaymentsEnabled: this.envDefault('PAYMENTS_ENABLED'),
        whatsappEnabled: this.envDefault('WHATSAPP_ENABLED'),
        smsEnabled: this.envDefault('SMS_ENABLED'),
      },
    });
    return this.store(row);
  }

  async update(input: Partial<AppSettings>): Promise<AppSettings> {
    const row = await this.prisma.appConfig.upsert({
      where: { id: SINGLETON_ID },
      update: input,
      create: {
        id: SINGLETON_ID,
        onlinePaymentsEnabled:
          input.onlinePaymentsEnabled ?? this.envDefault('PAYMENTS_ENABLED'),
        whatsappEnabled:
          input.whatsappEnabled ?? this.envDefault('WHATSAPP_ENABLED'),
        smsEnabled: input.smsEnabled ?? this.envDefault('SMS_ENABLED'),
      },
    });
    return this.store(row);
  }

  private store(row: AppSettings): AppSettings {
    this.cache = {
      onlinePaymentsEnabled: row.onlinePaymentsEnabled,
      whatsappEnabled: row.whatsappEnabled,
      smsEnabled: row.smsEnabled,
    };
    this.cachedAt = Date.now();
    return this.cache;
  }

  // Whether each integration has its credentials set on the server. Mirrors the
  // providers' isConfigured without creating a module dependency on them.
  get configured(): {
    payments: boolean;
    whatsapp: boolean;
    sms: boolean;
  } {
    return {
      payments: Boolean(
        this.config.get<string>('RAZORPAY_KEY_ID') &&
          this.config.get<string>('RAZORPAY_KEY_SECRET'),
      ),
      whatsapp: Boolean(
        this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID') &&
          this.config.get<string>('WHATSAPP_ACCESS_TOKEN'),
      ),
      sms: Boolean(this.config.get<string>('MSG91_AUTH_KEY')),
    };
  }
}
