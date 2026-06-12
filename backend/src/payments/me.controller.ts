import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { TicketsService } from '../tickets/tickets.service';
import { CheckoutService } from './checkout.service';

// Customer self-service: powers the web renewal flow and the app's
// Live Dashboard later (same endpoints, common database).
@Controller('me')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CUSTOMER)
export class MeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly checkout: CheckoutService,
    private readonly tickets: TicketsService,
  ) {}

  @Get('subscriptions')
  async mySubscriptions(@Req() req: any) {
    return this.prisma.subscription.findMany({
      where: { customer: { userId: req.user.sub } },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('dashboard')
  async myDashboard(@Req() req: any) {
    const customer = await this.prisma.customer.findFirstOrThrow({
      where: { userId: req.user.sub },
      include: {
        devices: { include: { product: true } },
        subscriptions: { include: { plan: true }, orderBy: { createdAt: 'desc' } },
        tickets: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    return customer;
  }

  @Post('subscriptions/:id/renew')
  renew(@Param('id') id: string, @Req() req: any) {
    return this.checkout.createRenewal(req.user.sub, id);
  }

  // Ticket status tracking with timeline (ownership-checked).
  @Get('tickets/:id')
  myTicket(@Param('id') id: string, @Req() req: any) {
    return this.tickets.findOneForUser(req.user.sub, id);
  }
}
