import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrderStatus, OrderType, Role } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

class ListOrdersDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(OrderType)
  type?: OrderType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}

class DeliverDto {
  @Type(() => Date)
  @IsDate()
  deliveryDate: Date;
}

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.BACKEND)
export class OrdersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get()
  async findAll(@Query() query: ListOrdersDto) {
    const page = Math.max(1, query.page ?? 1);
    const take = 20;
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          customer: { include: { user: true } },
          items: { include: { product: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * take,
        take,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total, page, pageSize: take };
  }

  // FRD: "Product Delivery update with Date" + prompt to pick an
  // installation slot once delivery is scheduled.
  @Patch(':id/deliver')
  async markDelivered(@Param('id') id: string, @Body() dto: DeliverDto) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { customer: { include: { user: true } } },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.DELIVERED },
    });

    const dateLabel = dto.deliveryDate.toLocaleDateString('en-IN');
    await this.notifications.sendBoth({
      recipient: order.customer.user.phone,
      template: 'DELIVERY_UPDATE',
      message: `Your Anthar Works order ${order.orderNo} will be delivered on ${dateLabel}. After delivery, pick your installation slot here: /account`,
      params: [order.orderNo, dateLabel],
      payload: { orderId: order.id },
    });
    return updated;
  }
}
