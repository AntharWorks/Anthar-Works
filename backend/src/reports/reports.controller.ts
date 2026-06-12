import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';
import { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ReportsService } from './reports.service';

class DateRangeDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.BACKEND)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('pending-tickets')
  async pendingTickets(@Res() res: Response) {
    const wb = await this.reports.pendingTicketsWorkbook();
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="pending-tickets-${Date.now()}.xlsx"`,
    });
    await wb.xlsx.write(res);
    res.end();
  }

  @Get('operations')
  async operations(@Query() range: DateRangeDto, @Res() res: Response) {
    const wb = await this.reports.operationsWorkbook(range.from, range.to);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="operations-report-${Date.now()}.xlsx"`,
    });
    await wb.xlsx.write(res);
    res.end();
  }
}
