import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role, TicketStatus, TicketType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TicketsService } from './tickets.service';

class CreateTicketDto {
  // Optional for CUSTOMER role (resolved from the JWT); required for staff.
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsEnum(TicketType)
  type: TicketType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  priority?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  slaDueAt?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  slotDate?: Date;

  @IsOptional()
  @IsString()
  slotWindow?: string;
}

class ListTicketsDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsString()
  technicianId?: string;

  @IsOptional()
  @Matches(/^\d{6}$/)
  pincode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}

class TransitionDto {
  @IsEnum(TicketStatus)
  to: TicketStatus;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

class AssignDto {
  @IsString()
  technicianId: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  slotDate?: Date;

  @IsOptional()
  @IsString()
  slotWindow?: string;
}

class PostponeDto {
  @Type(() => Date)
  @IsDate()
  slotDate: Date;

  @IsOptional()
  @IsString()
  slotWindow?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.BACKEND, Role.CUSTOMER)
  create(@Body() dto: CreateTicketDto, @Req() req: any) {
    if (req.user.role === Role.CUSTOMER) {
      return this.tickets.createForUser(req.user.sub, dto.type);
    }
    if (!dto.customerId) {
      throw new BadRequestException('customerId is required');
    }
    return this.tickets.create({
      ...dto,
      customerId: dto.customerId,
      createdById: req.user.sub,
    });
  }

  @Get()
  @Roles(Role.ADMIN, Role.BACKEND)
  findAll(@Query() query: ListTicketsDto) {
    return this.tickets.findAll(query);
  }

  @Get('mine')
  @Roles(Role.TECHNICIAN, Role.SALES)
  myTickets(@Req() req: any) {
    return this.tickets.findForTechnician(req.user.sub);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.BACKEND, Role.TECHNICIAN, Role.SALES)
  findOne(@Param('id') id: string) {
    return this.tickets.findOne(id);
  }

  @Patch(':id/assign')
  @Roles(Role.ADMIN, Role.BACKEND)
  assign(@Param('id') id: string, @Body() dto: AssignDto, @Req() req: any) {
    return this.tickets.assign(id, dto.technicianId, req.user.sub, {
      slotDate: dto.slotDate,
      slotWindow: dto.slotWindow,
    });
  }

  @Patch(':id/slot')
  @Roles(Role.ADMIN, Role.BACKEND)
  postpone(@Param('id') id: string, @Body() dto: PostponeDto, @Req() req: any) {
    return this.tickets.postponeSlot(id, req.user.sub, dto);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.BACKEND, Role.TECHNICIAN, Role.SALES)
  transition(
    @Param('id') id: string,
    @Body() dto: TransitionDto,
    @Req() req: any,
  ) {
    return this.tickets.transition(id, dto.to, req.user.sub, {
      reason: dto.reason,
      remarks: dto.remarks,
      actorRole: req.user.role,
    });
  }
}
