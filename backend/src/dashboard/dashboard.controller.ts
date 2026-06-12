import { Controller, Get, UseGuards } from '@nestjs/common';
import { Role, SubscriptionStatus, TicketStatus } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

const OPEN_STATUSES: TicketStatus[] = [
  TicketStatus.CREATED,
  TicketStatus.ASSIGNED,
  TicketStatus.ACCEPTED,
  TicketStatus.IN_TRANSIT,
  TicketStatus.IN_PROGRESS,
  TicketStatus.PENDING,
];

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.BACKEND)
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  // Master dashboard: active/inactive/stopped devices, ticket pipeline, SLA risk.
  @Get()
  async stats() {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const [
      customers,
      subsByStatus,
      ticketsByStatus,
      slaAtRisk,
      slaBreached,
      completedToday,
      technicians,
    ] = await this.prisma.$transaction([
      this.prisma.customer.count(),
      this.prisma.subscription.groupBy({
        by: ['status'],
        _count: true,
        orderBy: { status: 'asc' },
      }),
      this.prisma.ticket.groupBy({
        by: ['status'],
        _count: true,
        orderBy: { status: 'asc' },
      }),
      this.prisma.ticket.count({
        where: { status: { in: OPEN_STATUSES }, slaDueAt: { gt: now, lte: in24h } },
      }),
      this.prisma.ticket.count({
        where: { status: { in: OPEN_STATUSES }, slaDueAt: { lte: now } },
      }),
      this.prisma.ticket.count({
        where: { status: TicketStatus.COMPLETED, updatedAt: { gte: startOfDay } },
      }),
      this.prisma.user.count({ where: { role: Role.TECHNICIAN, status: 'ACTIVE' } }),
    ]);

    const subs = Object.fromEntries(
      subsByStatus.map((s) => [s.status, s._count]),
    ) as Record<SubscriptionStatus, number>;
    const tickets = Object.fromEntries(
      ticketsByStatus.map((t) => [t.status, t._count]),
    ) as Record<TicketStatus, number>;

    return {
      customers,
      subscriptions: {
        active: subs.ACTIVE ?? 0,
        inactive: subs.INACTIVE ?? 0,
        stopped: subs.STOPPED ?? 0,
      },
      tickets,
      openTickets: OPEN_STATUSES.reduce((sum, s) => sum + (tickets[s] ?? 0), 0),
      slaAtRisk,
      slaBreached,
      completedToday,
      technicians,
    };
  }
}
