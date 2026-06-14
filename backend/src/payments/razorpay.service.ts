import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay = require('razorpay');

export type GatewayOrder = {
  razorpayOrderId: string;
  keyId: string;
};

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private client: Razorpay | null = null;

  constructor(private readonly config: ConfigService) {
    const keyId = this.config.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (keyId && keySecret) {
      this.client = new Razorpay({ key_id: keyId, key_secret: keySecret });
    } else {
      // No keys: online checkout is unavailable and orders are taken offline
      // (staff mark them paid). The app still boots — see SettingsService and
      // the admin payments toggle.
      this.logger.warn(
        'Razorpay keys not configured — online payments are disabled; orders are taken offline',
      );
    }
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  get keySecret(): string {
    return this.config.get<string>('RAZORPAY_KEY_SECRET', '');
  }

  get webhookSecret(): string {
    return this.config.get<string>('RAZORPAY_WEBHOOK_SECRET', '');
  }

  // Only called when payments are live (client is configured).
  async createOrder(amountInr: number, receipt: string): Promise<GatewayOrder> {
    if (!this.client) {
      throw new Error('Razorpay is not configured');
    }
    const order = await this.client.orders.create({
      amount: Math.round(amountInr * 100), // paise
      currency: 'INR',
      receipt,
    });
    return {
      razorpayOrderId: order.id,
      keyId: this.config.get<string>('RAZORPAY_KEY_ID')!,
    };
  }
}
