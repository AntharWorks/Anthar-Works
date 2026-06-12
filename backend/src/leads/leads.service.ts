import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  LeadSource,
  LeadStatus,
  NotificationChannel,
  Role,
} from '@prisma/client';
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

  /**
   * FRD 1.5: temp-id lead becomes a unique customer id once the sale is
   * confirmed by the backend team.
   */
  async convert(
    id: string,
    input: { address?: string; pincode?: string; city?: string },
  ) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    if (lead.status === LeadStatus.CONVERTED && lead.customerId) {
      return this.prisma.lead.findUniqueOrThrow({
        where: { id },
        include: { customer: true },
      });
    }
    if (!lead.phone || !lead.name) {
      throw new BadRequestException(
        'Lead needs a name and phone number before conversion',
      );
    }
    const existing = await this.prisma.user.findUnique({
      where: { phone: lead.phone },
    });
    if (existing) {
      throw new BadRequestException(
        'A user with this phone already exists — link manually from the customer page',
      );
    }

    const count = await this.prisma.customer.count();
    const customer = await this.prisma.customer.create({
      data: {
        customerNo: `AW-${String(count + 1).padStart(6, '0')}`,
        address: input.address,
        pincode: input.pincode,
        city: input.city ?? lead.location,
        user: {
          create: { phone: lead.phone, name: lead.name, role: Role.CUSTOMER },
        },
      },
    });
    const updated = await this.prisma.lead.update({
      where: { id },
      data: { status: LeadStatus.CONVERTED, customerId: customer.id },
      include: { customer: true },
    });

    await this.notifications.sendBoth({
      recipient: lead.phone,
      template: 'CUSTOMER_WELCOME',
      message: `Welcome to Anthar Works, ${lead.name}! Your customer ID is ${customer.customerNo}. Track everything at /account.`,
      params: [lead.name, customer.customerNo],
      payload: { customerId: customer.id },
    });
    return updated;
  }
}
