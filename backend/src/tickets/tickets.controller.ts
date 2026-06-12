import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role, TicketStatus, TicketType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TicketsService } from './tickets.service';

class CreateTicketDto {
  @IsString()
  customerId: string;

  @IsEnum(TicketType)
  type: TicketType;
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

@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.BACKEND, Role.CUSTOMER)
  create(@Body() dto: CreateTicketDto, @Req() req: any) {
    return this.tickets.create({ ...dto, createdById: req.user.sub });
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
    });
  }

  @Get('mine')
  @Roles(Role.TECHNICIAN, Role.SALES)
  myTickets(@Req() req: any) {
    return this.tickets.findForTechnician(req.user.sub);
  }
}
