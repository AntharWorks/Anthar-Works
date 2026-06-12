import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TicketStatus, TicketType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { canTransition, requiresReason } from './ticket-state-machine';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  private async nextTicketNo(): Promise<string> {
    const count = await this.prisma.ticket.count();
    return `TKT-${String(count + 1).padStart(6, '0')}`;
  }

  async create(input: {
    customerId: string;
    type: TicketType;
    createdById: string;
    slaDueAt?: Date;
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

  async assign(
    ticketId: string,
    technicianId: string,
    actorId: string,
    slot?: { slotDate: Date; slotWindow: string },
  ) {
    return this.transition(ticketId, TicketStatus.ASSIGNED, actorId, {
      extra: { assignedTechnicianId: technicianId, ...slot },
    });
  }

  async transition(
    ticketId: string,
    to: TicketStatus,
    actorId: string,
    opts: { reason?: string; remarks?: string; extra?: object } = {},
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
    return updated;
  }

  findForTechnician(technicianId: string) {
    return this.prisma.ticket.findMany({
      where: {
        assignedTechnicianId: technicianId,
        status: { notIn: [TicketStatus.COMPLETED, TicketStatus.CANCELLED] },
      },
      include: { customer: { include: { user: true } } },
      orderBy: { slaDueAt: 'asc' },
    });
  }
}
