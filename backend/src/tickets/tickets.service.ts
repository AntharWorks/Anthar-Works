import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TicketStatus, TicketType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { canTransition, requiresReason } from './ticket-state-machine';

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async nextTicketNo(): Promise<string> {
    const count = await this.prisma.ticket.count();
    return `TKT-${String(count + 1).padStart(6, '0')}`;
  }

  async create(input: {
    customerId: string;
    type: TicketType;
    createdById: string;
    priority?: number;
    slaDueAt?: Date;
    slotDate?: Date;
    slotWindow?: string;
  }) {
    const ticketNo = await this.nextTicketNo();
    const ticket = await this.prisma.ticket.create({
      data: { ...input, ticketNo },
    });
    await this.prisma.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        toStatus: TicketStatus.CREATED,
        actorId: input.createdById,
      },
    });
    return ticket;
  }

  // Customer-raised complaint: resolve their customer record from the JWT.
  async createForUser(userId: string, type: TicketType) {
    const customer = await this.prisma.customer.findFirst({
      where: { userId },
    });
    if (!customer) {
      throw new NotFoundException('No customer profile for this account');
    }
    return this.create({
      customerId: customer.id,
      type,
      createdById: userId,
      slaDueAt: new Date(Date.now() + 48 * 3600 * 1000),
    });
  }

  async findOneForUser(userId: string, ticketId: string) {
    const ticket = await this.findOne(ticketId);
    if (ticket.customer.userId !== userId) {
      throw new NotFoundException('Ticket not found');
    }
    return ticket;
  }

  async findAll(params: {
    status?: TicketStatus;
    technicianId?: string;
    pincode?: string;
    page?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const take = 20;
    const where: Prisma.TicketWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.technicianId
        ? { assignedTechnicianId: params.technicianId }
        : {}),
      ...(params.pincode ? { customer: { pincode: params.pincode } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        include: {
          customer: { include: { user: true } },
          assignedTechnician: true,
        },
        orderBy: [
          { slaDueAt: { sort: 'asc', nulls: 'last' } },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * take,
        take,
      }),
      this.prisma.ticket.count({ where }),
    ]);
    return { items, total, page, pageSize: take };
  }

  async findOne(id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        customer: { include: { user: true } },
        assignedTechnician: true,
        createdBy: true,
        events: { include: { actor: true }, orderBy: { createdAt: 'asc' } },
        spareUsage: { include: { part: true } },
        media: true,
      },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    return ticket;
  }

  async assign(
    ticketId: string,
    technicianId: string,
    actorId: string,
    slot?: { slotDate?: Date; slotWindow?: string },
  ) {
    return this.transition(ticketId, TicketStatus.ASSIGNED, actorId, {
      remarks: 'Assigned to technician',
      extra: { assignedTechnicianId: technicianId, ...(slot ?? {}) },
    });
  }

  // Customer slot postponement with remarks, per FRD 1.3.
  async postponeSlot(
    ticketId: string,
    actorId: string,
    slot: { slotDate: Date; slotWindow?: string; remarks?: string },
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    const [updated] = await this.prisma.$transaction([
      this.prisma.ticket.update({
        where: { id: ticketId },
        data: { slotDate: slot.slotDate, slotWindow: slot.slotWindow },
      }),
      this.prisma.ticketEvent.create({
        data: {
          ticketId,
          actorId,
          remarks: `Slot postponed to ${slot.slotDate.toISOString()}${
            slot.slotWindow ? ` (${slot.slotWindow})` : ''
          }${slot.remarks ? ` — ${slot.remarks}` : ''}`,
        },
      }),
    ]);
    return updated;
  }

  async transition(
    ticketId: string,
    to: TicketStatus,
    actorId: string,
    opts: {
      reason?: string;
      remarks?: string;
      extra?: object;
      actorRole?: string;
    } = {},
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    if (!canTransition(ticket.status, to)) {
      throw new BadRequestException(
        `Cannot move ticket from ${ticket.status} to ${to}`,
      );
    }
    if (requiresReason(to) && !opts.reason) {
      throw new BadRequestException(`A reason is required to mark ${to}`);
    }

    // FRD 1.4/1.5: field staff must upload live before & after photos
    // (camera-only, geotagged) before a job can be completed.
    if (
      to === TicketStatus.COMPLETED &&
      (opts.actorRole === 'TECHNICIAN' || opts.actorRole === 'SALES')
    ) {
      const phases = await this.prisma.ticketMedia.groupBy({
        by: ['phase'],
        where: { ticketId },
        _count: true,
        orderBy: { phase: 'asc' },
      });
      const have = new Set(phases.map((p) => p.phase));
      if (!have.has('BEFORE') || !have.has('AFTER')) {
        throw new BadRequestException(
          'Before and after photos are required to complete this job',
        );
      }
    }

    const reasonField =
      to === TicketStatus.CANCELLED
        ? { cancellationReason: opts.reason }
        : to === TicketStatus.REJECTED
          ? { rejectionReason: opts.reason }
          : {};

    const [updated] = await this.prisma.$transaction([
      this.prisma.ticket.update({
        where: { id: ticketId },
        data: { status: to, ...reasonField, ...(opts.extra ?? {}) },
      }),
      this.prisma.ticketEvent.create({
        data: {
          ticketId,
          fromStatus: ticket.status,
          toStatus: to,
          actorId,
          remarks: opts.remarks ?? opts.reason,
        },
      }),
    ]);
    await this.notifyTransition(updated.id, to);
    return updated;
  }

  private async notifyTransition(ticketId: string, to: TicketStatus) {
    if (to !== TicketStatus.ASSIGNED && to !== TicketStatus.COMPLETED) return;
    const ticket = await this.prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      include: {
        customer: { include: { user: true } },
        assignedTechnician: true,
      },
    });
    const customerPhone = ticket.customer.user.phone;

    if (to === TicketStatus.ASSIGNED) {
      const slot = ticket.slotDate
        ? `${ticket.slotDate.toLocaleDateString('en-IN')}${ticket.slotWindow ? ` (${ticket.slotWindow})` : ''}`
        : 'to be confirmed';
      await this.notifications.sendBoth({
        recipient: customerPhone,
        template: 'TICKET_SCHEDULED',
        message: `Your Anthar Works ticket ${ticket.ticketNo} (${ticket.type}) is scheduled for ${slot}.`,
        params: [ticket.ticketNo, ticket.type, slot],
        payload: { ticketId: ticket.id },
      });
      if (ticket.assignedTechnician) {
        await this.notifications.send({
          recipient: ticket.assignedTechnician.phone,
          channel: 'SMS',
          template: 'TECHNICIAN_JOB_ALERT',
          message: `New job ${ticket.ticketNo} (${ticket.type}) assigned to you. Slot: ${slot}. Open the app to accept.`,
          payload: { ticketId: ticket.id },
        });
      }
    } else {
      await this.notifications.sendBoth({
        recipient: customerPhone,
        template: 'TICKET_COMPLETED',
        message: `Your Anthar Works ticket ${ticket.ticketNo} has been completed. Thank you!`,
        params: [ticket.ticketNo],
        payload: { ticketId: ticket.id },
      });
    }
  }

  findForTechnician(technicianId: string) {
    return this.prisma.ticket.findMany({
      where: {
        assignedTechnicianId: technicianId,
        status: { notIn: [TicketStatus.COMPLETED, TicketStatus.CANCELLED] },
      },
      include: { customer: { include: { user: true } } },
      orderBy: { slaDueAt: { sort: 'asc', nulls: 'last' } },
    });
  }
}
