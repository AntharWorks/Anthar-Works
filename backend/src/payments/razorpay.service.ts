import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import Razorpay = require('razorpay');

export type GatewayOrder = {
  razorpayOrderId: string;
  keyId: string | null;
  /** True when running without Razorpay keys (local/dev only). */
  testMode: boolean;
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
    } else if (this.config.get('NODE_ENV') === 'production') {
      throw new Error('RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET are required in production');
    } else {
      this.logger.warn(
        'Razorpay keys not configured — checkout runs in simulated test mode',
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

  async createOrder(amountInr: number, receipt: string): Promise<GatewayOrder> {
    if (!this.client) {
      return {
        razorpayOrderId: `order_dev_${randomBytes(8).toString('hex')}`,
        keyId: null,
        testMode: true,
      };
    }
    const order = await this.client.orders.create({
      amount: Math.round(amountInr * 100), // paise
      currency: 'INR',
      receipt,
    });
    return {
      razorpayOrderId: order.id,
      keyId: this.config.get<string>('RAZORPAY_KEY_ID')!,
      testMode: false,
    };
  }
}
