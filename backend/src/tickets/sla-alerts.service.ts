import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TicketStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const OPEN_STATUSES: TicketStatus[] = [
  TicketStatus.CREATED,
  TicketStatus.ASSIGNED,
  TicketStatus.ACCEPTED,
  TicketStatus.IN_TRANSIT,
  TicketStatus.IN_PROGRESS,
  TicketStatus.PENDING,
];

// FRD 1.3 SLA alerts: hourly scan for tickets approaching or past their
// SLA deadline; pushes a summary to the company WhatsApp so breaches are
// never silent. The portal shows the same data live via color-coding.
@Injectable()
export class SlaAlertsService {
  private readonly logger = new Logger(SlaAlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async scan() {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 3600 * 1000);

    const [breached, dueSoon] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where: { status: { in: OPEN_STATUSES }, slaDueAt: { lte: now } },
        select: { ticketNo: true },
        take: 20,
      }),
      this.prisma.ticket.findMany({
        where: {
          status: { in: OPEN_STATUSES },
          slaDueAt: { gt: now, lte: in24h },
        },
        select: { ticketNo: true },
        take: 20,
      }),
    ]);

    if (breached.length === 0 && dueSoon.length === 0) return;

    const message =
      `SLA alert — ${breached.length} ticket(s) BREACHED` +
      (breached.length ? ` (${breached.map((t) => t.ticketNo).join(', ')})` : '') +
      `, ${dueSoon.length} due within 24h` +
      (dueSoon.length ? ` (${dueSoon.map((t) => t.ticketNo).join(', ')})` : '') +
      '.';

    this.logger.warn(message);
    await this.notifications.notifyCompany('SLA_ALERT', message, [
      String(breached.length),
      String(dueSoon.length),
    ]);
  }
}
