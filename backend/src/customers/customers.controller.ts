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
import { Role, SubscriptionStatus, WarrantyType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CustomersService } from './customers.service';

class CreateCustomerDto {
  @Matches(/^[6-9]\d{9}$/, { message: 'phone must be a valid Indian mobile number' })
  phone: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'pincode must be 6 digits' })
  pincode?: string;

  @IsOptional()
  @IsString()
  city?: string;
}

class ListCustomersDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Matches(/^\d{6}$/)
  pincode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}

class AddDeviceDto {
  @IsString()
  productId: string;

  @Type(() => Date)
  @IsDate()
  purchaseDate: Date;

  @IsEnum(WarrantyType)
  warrantyType: WarrantyType;
}

class AddSubscriptionDto {
  @IsString()
  planId: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;
}

class SubscriptionStatusDto {
  @IsEnum(SubscriptionStatus)
  status: SubscriptionStatus;
}

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.BACKEND)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.customers.create(dto);
  }

  @Get()
  findAll(@Query() query: ListCustomersDto) {
    return this.customers.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customers.findOne(id);
  }

  @Post(':id/devices')
  addDevice(@Param('id') id: string, @Body() dto: AddDeviceDto) {
    return this.customers.addDevice(id, dto);
  }

  @Post(':id/subscriptions')
  addSubscription(@Param('id') id: string, @Body() dto: AddSubscriptionDto) {
    return this.customers.addSubscription(id, dto);
  }

  @Patch('subscriptions/:subscriptionId/status')
  setSubscriptionStatus(
    @Param('subscriptionId') subscriptionId: string,
    @Body() dto: SubscriptionStatusDto,
  ) {
    return this.customers.setSubscriptionStatus(subscriptionId, dto.status);
  }
}
