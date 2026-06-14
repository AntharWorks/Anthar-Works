import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { SmsProvider } from './sms.provider';
import { WhatsappProvider } from './whatsapp.provider';

type SendInput = {
  recipient: string | null; // phone number (null for email-only accounts)
  channel: NotificationChannel;
  template: string; // template key (WhatsApp template name / SMS flow)
  message: string; // rendered text (SMS body / dev log)
  params?: string[]; // WhatsApp template body params
  payload?: Record<string, unknown>;
};

/**
 * Every outbound message is recorded in notifications_log (QUEUED → SENT or
 * FAILED) and dispatched asynchronously so request latency is never coupled
 * to provider latency. Dispatch is in-process for now; it moves onto the
 * BullMQ/Redis worker when production infra is provisioned (Phase 4) without
 * changing any caller.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  // Login OTP must always be deliverable, even when the SMS channel is off.
  private static readonly ALWAYS_ALLOWED_TEMPLATES = new Set(['APP_LOGIN_OTP']);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsProvider,
    private readonly whatsapp: WhatsappProvider,
    private readonly settings: SettingsService,
  ) {}

  async send(input: SendInput): Promise<void> {
    // Email-only accounts may have no phone — nothing to send over SMS/WhatsApp.
    const recipient = input.recipient;
    if (!recipient) {
      this.logger.warn(
        `Skipping ${input.template} (${input.channel}): no recipient`,
      );
      return;
    }
    const log = await this.prisma.notificationLog.create({
      data: {
        recipient,
        channel: input.channel,
        template: input.template,
        payload: (input.payload ?? { message: input.message }) as object,
      },
    });
    void this.dispatch(log.id, { ...input, recipient });
  }

  // Convenience: same content over both WhatsApp and SMS, per FRD
  // "timely notifications of all updates in both WhatsApp & SMS".
  async sendBoth(input: Omit<SendInput, 'channel'>): Promise<void> {
    await Promise.all([
      this.send({ ...input, channel: NotificationChannel.WHATSAPP }),
      this.send({ ...input, channel: NotificationChannel.SMS }),
    ]);
  }

  async notifyCompany(template: string, message: string, params: string[]) {
    const recipient = this.whatsapp.companyRecipient;
    if (!recipient) {
      this.logger.log(`[DEV COMPANY ALERT] ${template}: ${message}`);
      return;
    }
    await this.send({
      recipient,
      channel: NotificationChannel.WHATSAPP,
      template,
      message,
      params,
    });
  }

  // Admin channel toggle: when a channel is off we record the message as
  // SUPPRESSED instead of sending it. Login OTP is always exempt so sign-in
  // keeps working.
  private async isChannelEnabled(input: SendInput): Promise<boolean> {
    if (NotificationsService.ALWAYS_ALLOWED_TEMPLATES.has(input.template)) {
      return true;
    }
    const settings = await this.settings.getSettings();
    if (input.channel === NotificationChannel.WHATSAPP) {
      return settings.whatsappEnabled;
    }
    if (input.channel === NotificationChannel.SMS) {
      return settings.smsEnabled;
    }
    return true;
  }

  private async dispatch(
    logId: string,
    input: SendInput & { recipient: string },
  ): Promise<void> {
    if (!(await this.isChannelEnabled(input))) {
      this.logger.log(
        `[SUPPRESSED ${input.channel}] ${input.template} → ${input.recipient} (channel disabled by admin)`,
      );
      await this.prisma.notificationLog
        .update({
          where: { id: logId },
          data: { status: NotificationStatus.SUPPRESSED },
        })
        .catch(() => undefined);
      return;
    }
    try {
      const providerMessageId =
        input.channel === NotificationChannel.WHATSAPP
          ? await this.whatsapp.send(
              input.recipient,
              input.template,
              input.params ?? [input.message],
            )
          : await this.sms.send(input.recipient, input.message);
      await this.prisma.notificationLog.update({
        where: { id: logId },
        data: { status: NotificationStatus.SENT, providerMessageId },
      });
    } catch (error) {
      this.logger.error(
        `Notification ${logId} (${input.channel} → ${input.recipient}) failed: ${error}`,
      );
      await this.prisma.notificationLog
        .update({
          where: { id: logId },
          data: { status: NotificationStatus.FAILED },
        })
        .catch(() => undefined);
    }
  }
}
