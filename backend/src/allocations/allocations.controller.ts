import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsOptional, IsString, Matches } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

class CreateAllocationDto {
  @IsString()
  backendId: string;

  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'pincode must be 6 digits' })
  pincode?: string;

  @IsOptional()
  @IsString()
  productId?: string;
}

class MapTechnicianDto {
  @IsString()
  backendId: string;

  @IsString()
  technicianId: string;
}

// FRD 1.2: Admin allocates customer data to backend staff by pincode or
// model, and assigns each backend a set of technicians for tracking.
@Controller('allocations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AllocationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles(Role.ADMIN, Role.BACKEND)
  list() {
    return this.prisma.backendAllocation.findMany({
      include: { backend: true, product: true },
      orderBy: { backendId: 'asc' },
    });
  }

  @Post()
  @Roles(Role.ADMIN)
  async create(@Body() dto: CreateAllocationDto) {
    if (!dto.pincode === !dto.productId) {
      throw new BadRequestException(
        'Provide exactly one of pincode or productId',
      );
    }
    const backend = await this.prisma.user.findFirst({
      where: { id: dto.backendId, role: Role.BACKEND },
    });
    if (!backend) {
      throw new BadRequestException('backendId must be a BACKEND staff user');
    }
    return this.prisma.backendAllocation.create({
      data: dto,
      include: { backend: true, product: true },
    });
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.prisma.backendAllocation.delete({ where: { id } });
  }

  @Get('technician-map')
  @Roles(Role.ADMIN, Role.BACKEND)
  listTechnicianMap() {
    return this.prisma.backendTechnician.findMany({
      include: { backend: true, technician: true },
      orderBy: { backendId: 'asc' },
    });
  }

  @Post('technician-map')
  @Roles(Role.ADMIN)
  async mapTechnician(@Body() dto: MapTechnicianDto) {
    const [backend, technician] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: dto.backendId, role: Role.BACKEND },
      }),
      this.prisma.user.findFirst({
        where: { id: dto.technicianId, role: Role.TECHNICIAN },
      }),
    ]);
    if (!backend || !technician) {
      throw new BadRequestException(
        'backendId must be BACKEND staff and technicianId must be a TECHNICIAN',
      );
    }
    return this.prisma.backendTechnician.upsert({
      where: {
        backendId_technicianId: {
          backendId: dto.backendId,
          technicianId: dto.technicianId,
        },
      },
      update: {},
      create: dto,
      include: { backend: true, technician: true },
    });
  }

  @Delete('technician-map/:id')
  @Roles(Role.ADMIN)
  unmapTechnician(@Param('id') id: string) {
    return this.prisma.backendTechnician.delete({ where: { id } });
  }
}
