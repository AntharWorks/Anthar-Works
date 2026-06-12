import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

class ListNotificationsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}

// Delivery visibility: staff can audit every WhatsApp/SMS/push sent.
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.BACKEND)
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(@Query() query: ListNotificationsDto) {
    const page = Math.max(1, query.page ?? 1);
    const take = 30;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notificationLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * take,
        take,
      }),
      this.prisma.notificationLog.count(),
    ]);
    return { items, total, page, pageSize: take };
  }
}
