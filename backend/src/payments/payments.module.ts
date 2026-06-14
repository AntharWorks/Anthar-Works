import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import { TicketsModule } from '../tickets/tickets.module';
import { CheckoutService } from './checkout.service';
import { MeController } from './me.controller';
import { OrdersController } from './orders.controller';
import { PaymentsController } from './payments.controller';
import { RazorpayService } from './razorpay.service';

@Module({
  imports: [AuthModule, TicketsModule, SettingsModule],
  controllers: [PaymentsController, MeController, OrdersController],
  providers: [CheckoutService, RazorpayService],
  exports: [RazorpayService],
})
export class PaymentsModule {}
