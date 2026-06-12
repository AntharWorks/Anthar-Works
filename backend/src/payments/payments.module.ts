import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CheckoutService } from './checkout.service';
import { MeController } from './me.controller';
import { PaymentsController } from './payments.controller';
import { RazorpayService } from './razorpay.service';

@Module({
  imports: [AuthModule],
  controllers: [PaymentsController, MeController],
  providers: [CheckoutService, RazorpayService],
  exports: [RazorpayService],
})
export class PaymentsModule {}
