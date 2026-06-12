import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * MSG91 SMS provider (DLT-registered flow templates). Without credentials
 * (local/dev) messages are logged instead of sent, so every flow stays
 * exercisable end-to-end.
 */
@Injectable()
export class SmsProvider {
  private readonly logger = new Logger(SmsProvider.name);

  constructor(private readonly config: ConfigService) {}

  get isConfigured(): boolean {
    return Boolean(this.config.get('MSG91_AUTH_KEY'));
  }

  async send(phone: string, message: string): Promise<string> {
    if (!this.isConfigured) {
      this.logger.log(`[DEV SMS → ${phone}] ${message}`);
      return `dev-sms-${Date.now()}`;
    }
    const res = await fetch('https://control.msg91.com/api/v5/flow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: this.config.get<string>('MSG91_AUTH_KEY')!,
      },
      body: JSON.stringify({
        template_id: this.config.get<string>('MSG91_OTP_TEMPLATE_ID'),
        sender: this.config.get<string>('MSG91_SENDER_ID'),
        recipients: [{ mobiles: `91${phone}`, message }],
      }),
    });
    const data = (await res.json()) as { request_id?: string; message?: string };
    if (!res.ok) {
      throw new Error(`MSG91 send failed: ${data?.message ?? res.status}`);
    }
    return data.request_id ?? 'msg91';
  }
}
