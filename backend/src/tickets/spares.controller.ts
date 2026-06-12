import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

class UseSpareDto {
  @IsString()
  partId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty: number;
}

// FRD 1.4: searchable spare-parts checklist; technicians mark items used.
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class SparesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('spare-parts')
  @Roles(Role.ADMIN, Role.BACKEND, Role.TECHNICIAN, Role.SALES)
  findAll(@Query('q') q?: string) {
    return this.prisma.sparePart.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { sku: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { name: 'asc' },
    });
  }

  @Post('tickets/:id/spares')
  @Roles(Role.TECHNICIAN, Role.SALES, Role.BACKEND, Role.ADMIN)
  async useSpare(@Param('id') ticketId: string, @Body() dto: UseSpareDto) {
    return this.prisma.ticketSpareUsage.upsert({
      where: { ticketId_partId: { ticketId, partId: dto.partId } },
      update: { qty: dto.qty },
      create: { ticketId, partId: dto.partId, qty: dto.qty },
      include: { part: true },
    });
  }
}
