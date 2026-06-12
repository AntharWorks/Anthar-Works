import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { SubscriptionStatus, TicketStatus, TicketType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

const DAY = 24 * 3600 * 1000;

/**
 * Daily lifecycle notifications (FRD 1.1): renewal reminders, 1-year
 * warranty expiry notices, and the installation-day FAQ video push.
 * Each send is deduped against notifications_log so reruns are safe.
 */
@Injectable()
export class LifecycleCronsService {
  private readonly logger = new Logger(LifecycleCronsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  // 03:30 UTC = 09:00 IST
  @Cron('30 3 * * *')
  async scan() {
    await this.renewalReminders();
    await this.warrantyExpiryNotices();
    await this.installationDayFaqVideo();
  }

  private async alreadySent(
    recipient: string,
    template: string,
    withinMs: number,
  ): Promise<boolean> {
    const existing = await this.prisma.notificationLog.findFirst({
      where: {
        recipient,
        template,
        createdAt: { gte: new Date(Date.now() - withinMs) },
      },
    });
    return existing !== null;
  }

  private async renewalReminders() {
    const now = new Date();
    const subs = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        nextRenewalAt: { gt: now, lte: new Date(now.getTime() + 3 * DAY) },
      },
      include: { plan: true, customer: { include: { user: true } } },
    });
    for (const sub of subs) {
      const phone = sub.customer.user.phone;
      if (await this.alreadySent(phone, 'RENEWAL_REMINDER', 3 * DAY)) continue;
      const date = sub.nextRenewalAt!.toLocaleDateString('en-IN');
      await this.notifications.sendBoth({
        recipient: phone,
        template: 'RENEWAL_REMINDER',
        message: `Your Anthar Works ${sub.plan.name} subscription renews on ${date}. Renew in one click: /renew`,
        params: [sub.plan.name, date],
        payload: { subscriptionId: sub.id },
      });
    }
    if (subs.length) this.logger.log(`Renewal reminders: ${subs.length} due`);
  }

  private async warrantyExpiryNotices() {
    const now = new Date();
    const devices = await this.prisma.customerDevice.findMany({
      where: {
        warrantyExpiry: { gt: now, lte: new Date(now.getTime() + 30 * DAY) },
      },
      include: { product: true, customer: { include: { user: true } } },
    });
    for (const device of devices) {
      const phone = device.customer.user.phone;
      if (await this.alreadySent(phone, 'WARRANTY_EXPIRY', 30 * DAY)) continue;
      const date = device.warrantyExpiry.toLocaleDateString('en-IN');
      await this.notifications.sendBoth({
        recipient: phone,
        template: 'WARRANTY_EXPIRY',
        message: `The warranty on your ${device.product.brand} ${device.product.model} ends on ${date}. Talk to us about an AMC plan or upgrade: /products`,
        params: [`${device.product.brand} ${device.product.model}`, date],
        payload: { deviceId: device.id },
      });
    }
    if (devices.length) {
      this.logger.log(`Warranty notices: ${devices.length} expiring soon`);
    }
  }

  private async installationDayFaqVideo() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay.getTime() + DAY);
    const tickets = await this.prisma.ticket.findMany({
      where: {
        type: TicketType.INSTALLATION,
        slotDate: { gte: startOfDay, lt: endOfDay },
        status: {
          in: [
            TicketStatus.ASSIGNED,
            TicketStatus.ACCEPTED,
            TicketStatus.IN_TRANSIT,
          ],
        },
      },
      include: { customer: { include: { user: true } } },
    });
    const videoUrl = this.config.get<string>(
      'FAQ_VIDEO_URL',
      'https://antharworks.example/faq-video',
    );
    for (const ticket of tickets) {
      const phone = ticket.customer.user.phone;
      if (await this.alreadySent(phone, 'FAQ_VIDEO', DAY)) continue;
      await this.notifications.sendBoth({
        recipient: phone,
        template: 'FAQ_VIDEO',
        message: `It's installation day! 🎉 Your technician is on the way for ${ticket.ticketNo}. Meanwhile, watch the quick-start FAQ video: ${videoUrl}`,
        params: [ticket.ticketNo, videoUrl],
        payload: { ticketId: ticket.id },
      });
    }
    if (tickets.length) {
      this.logger.log(`Installation-day FAQ pushes: ${tickets.length}`);
    }
  }
}
