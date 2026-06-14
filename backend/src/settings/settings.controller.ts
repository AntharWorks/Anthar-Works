import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsBoolean, IsOptional } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SettingsService } from './settings.service';

class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  onlinePaymentsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  whatsappEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;
}

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  // Public: lets the storefront decide whether to show "Pay with Razorpay" or
  // "Place order" (offline). Exposes no secrets.
  @Get('public')
  async publicSettings() {
    const { onlinePaymentsEnabled } = await this.settings.getSettings();
    const paymentsConfigured = this.settings.configured.payments;
    return {
      onlinePaymentsEnabled,
      paymentsConfigured,
      paymentsLive: onlinePaymentsEnabled && paymentsConfigured,
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async adminSettings() {
    return {
      ...(await this.settings.getSettings()),
      configured: this.settings.configured,
    };
  }

  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async update(@Body() dto: UpdateSettingsDto) {
    return {
      ...(await this.settings.update(dto)),
      configured: this.settings.configured,
    };
  }
}
