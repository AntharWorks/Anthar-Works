import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Meta WhatsApp Cloud API provider. Production messages must use templates
 * pre-approved in Meta Business Manager; `template` is the approved template
 * name and `bodyParams` fill its {{n}} placeholders. Unconfigured (dev),
 * messages are logged instead.
 */
@Injectable()
export class WhatsappProvider {
  private readonly logger = new Logger(WhatsappProvider.name);

  constructor(private readonly config: ConfigService) {}

  get isConfigured(): boolean {
    return Boolean(
      this.config.get('WHATSAPP_PHONE_NUMBER_ID') &&
        this.config.get('WHATSAPP_ACCESS_TOKEN'),
    );
  }

  get companyRecipient(): string | undefined {
    return this.config.get<string>('WHATSAPP_COMPANY_RECIPIENT') || undefined;
  }

  async send(
    phone: string,
    template: string,
    bodyParams: string[],
  ): Promise<string> {
    if (!this.isConfigured) {
      this.logger.log(
        `[DEV WHATSAPP → ${phone}] template=${template} params=${JSON.stringify(bodyParams)}`,
      );
      return `dev-wa-${Date.now()}`;
    }
    const phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.get('WHATSAPP_ACCESS_TOKEN')}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: `91${phone}`,
          type: 'template',
          template: {
            name: template,
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: bodyParams.map((text) => ({ type: 'text', text })),
              },
            ],
          },
        }),
      },
    );
    const data = (await res.json()) as {
      messages?: { id: string }[];
      error?: { message: string };
    };
    if (!res.ok) {
      throw new Error(`WhatsApp send failed: ${data?.error?.message ?? res.status}`);
    }
    return data.messages?.[0]?.id ?? 'whatsapp';
  }
}
