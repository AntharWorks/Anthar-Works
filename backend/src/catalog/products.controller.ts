import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

class CreateProductDto {
  @IsString()
  brand: string;

  @IsString()
  model: string;

  @IsOptional()
  @IsString()
  variant?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceInr: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

@Controller('products')
export class ProductsController {
  constructor(private readonly prisma: PrismaService) {}

  // Public: powers the multi-brand storefront catalog.
  @Get()
  findAll() {
    return this.prisma.product.findMany({
      where: { active: true },
      orderBy: [{ brand: 'asc' }, { model: 'asc' }],
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateProductDto) {
    return this.prisma.product.create({ data: dto });
  }
}
