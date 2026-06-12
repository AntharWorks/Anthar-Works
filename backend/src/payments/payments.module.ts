import { Module } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { PaymentsController } from './payments.controller';
import { RazorpayService } from './razorpay.service';

@Module({
  controllers: [PaymentsController],
  providers: [CheckoutService, RazorpayService],
  exports: [RazorpayService],
})
export class PaymentsModule {}
