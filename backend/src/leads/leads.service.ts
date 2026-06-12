import { Injectable } from '@nestjs/common';
import { LeadSource, LeadStatus, NotificationChannel } from '@prisma/client';
import { randomBytes } from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * FRD marketing automation: a product tap (or referral/buy-back interest)
   * immediately creates a lead, sends the customer a WhatsApp follow-up, and
   * pushes the lead details to the company instantly.
   */
  async capture(input: {
    source: LeadSource;
    name?: string;
    phone?: string;
    location?: string;
    productId?: string;
  }) {
    const product = input.productId
      ? await this.prisma.product.findUnique({ where: { id: input.productId } })
      : null;

    const lead = await this.prisma.lead.create({
      data: {
        tempId: `LD-${randomBytes(4).toString('hex').toUpperCase()}`,
        source: input.source,
        name: input.name,
        phone: input.phone,
        location: input.location,
        interestProduct: product?.id,
      },
    });

    const productLabel = product ? `${product.brand} ${product.model}` : 'our purifiers';
    if (input.phone) {
      await this.notifications.send({
        recipient: input.phone,
        channel: NotificationChannel.WHATSAPP,
        template: 'LEAD_FOLLOWUP',
        message: `Hi${input.name ? ` ${input.name}` : ''}! Thanks for your interest in ${productLabel}. Our team will reach out shortly with the best offer.`,
        params: [input.name ?? 'there', productLabel],
        payload: { leadId: lead.id },
      });
    }
    await this.notifications.notifyCompany(
      'NEW_LEAD_ALERT',
      `New lead ${lead.tempId} (${input.source}): ${input.name ?? 'Unknown'} ${input.phone ?? ''} ${input.location ?? ''} — interest: ${productLabel}.`,
      [lead.tempId, input.name ?? 'Unknown', productLabel],
    );

    return lead;
  }

  findAll(status?: LeadStatus) {
    return this.prisma.lead.findMany({
      where: status ? { status } : undefined,
      include: { product: true, assignedSales: true, customer: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  update(
    id: string,
    data: { status?: LeadStatus; assignedSalesId?: string },
  ) {
    return this.prisma.lead.update({ where: { id }, data });
  }
}
