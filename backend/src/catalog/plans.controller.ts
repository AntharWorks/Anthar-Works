import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BillingPeriod, Role } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

class CreatePlanDto {
  @IsString()
  name: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceInr: number;

  @IsEnum(BillingPeriod)
  billingPeriod: BillingPeriod;

  // Admin "Custom Plans" for high-volume users, per FRD.
  @IsOptional()
  @IsBoolean()
  isCustom?: boolean;
}

@Controller('plans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlansController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles(Role.ADMIN, Role.BACKEND)
  findAll() {
    return this.prisma.plan.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreatePlanDto, @Req() req: any) {
    return this.prisma.plan.create({
      data: { ...dto, createdById: req.user.sub },
    });
  }
}
