import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LifecycleCronsService } from './lifecycle-crons.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SmsProvider } from './sms.provider';
import { WhatsappProvider } from './whatsapp.provider';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    SmsProvider,
    WhatsappProvider,
    LifecycleCronsService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
