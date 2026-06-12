import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SlaAlertsService } from './sla-alerts.service';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [AuthModule],
  controllers: [TicketsController],
  providers: [TicketsService, SlaAlertsService],
  exports: [TicketsService],
})
export class TicketsModule {}
