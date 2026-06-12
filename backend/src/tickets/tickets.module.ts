import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MediaController } from './media.controller';
import { SlaAlertsService } from './sla-alerts.service';
import { SparesController } from './spares.controller';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [AuthModule],
  controllers: [TicketsController, SparesController, MediaController],
  providers: [TicketsService, SlaAlertsService],
  exports: [TicketsService],
})
export class TicketsModule {}
