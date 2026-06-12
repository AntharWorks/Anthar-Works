import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { SmsProvider } from './sms.provider';
import { WhatsappProvider } from './whatsapp.provider';

@Global()
@Module({
  providers: [NotificationsService, SmsProvider, WhatsappProvider],
  exports: [NotificationsService],
})
export class NotificationsModule {}
