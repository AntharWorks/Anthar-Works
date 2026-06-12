import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LeadSource, LeadStatus, Role } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { LeadsService } from './leads.service';

class CaptureLeadDto {
  @IsEnum(LeadSource)
  source: LeadSource;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Matches(/^[6-9]\d{9}$/, { message: 'phone must be a valid Indian mobile number' })
  phone?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  productId?: string;
}

class UpdateLeadDto {
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @IsString()
  assignedSalesId?: string;
}

@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  // Public: fired by storefront product taps, referral and buy-back forms.
  @Post()
  capture(@Body() dto: CaptureLeadDto) {
    return this.leads.capture(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.BACKEND, Role.SALES)
  findAll(@Query('status') status?: LeadStatus) {
    return this.leads.findAll(status);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.BACKEND, Role.SALES)
  update(@Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.leads.update(id, dto);
  }
}
