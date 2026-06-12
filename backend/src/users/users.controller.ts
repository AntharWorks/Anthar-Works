import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsEnum, IsString, Matches } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsersService } from './users.service';

class CreateStaffLoginDto {
  @Matches(/^[6-9]\d{9}$/, { message: 'phone must be a valid Indian mobile number' })
  phone: string;

  @IsString()
  name: string;

  @IsEnum(Role)
  role: Role;
}

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  @Roles(Role.ADMIN)
  createStaffLogin(@Body() dto: CreateStaffLoginDto) {
    return this.users.createStaffLogin(dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.BACKEND)
  findAll(@Query('role') role?: Role) {
    return this.users.findAll(role);
  }
}
