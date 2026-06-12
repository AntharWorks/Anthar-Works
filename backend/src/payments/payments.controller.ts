import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Request } from 'express';
import { CheckoutService } from './checkout.service';
import { verifyWebhookSignature } from './razorpay-signature';
import { RazorpayService } from './razorpay.service';

class CheckoutItemDto {
  @IsString()
  productId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty: number;
}

class CreateCheckoutDto {
  @IsString()
  name: string;

  @Matches(/^[6-9]\d{9}$/, { message: 'phone must be a valid Indian mobile number' })
  phone: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @Matches(/^\d{6}$/)
  pincode?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items: CheckoutItemDto[];
}

class ConfirmPaymentDto {
  @IsString()
  razorpayOrderId: string;

  @IsString()
  razorpayPaymentId: string;

  @IsString()
  razorpaySignature: string;
}

// Public endpoints: the storefront checkout is used by customers without a
// staff login. Payment truth is established by signatures, never by trust.
@Controller()
export class PaymentsController {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly razorpay: RazorpayService,
  ) {}

  @Post('checkout')
  create(@Body() dto: CreateCheckoutDto) {
    return this.checkout.createCheckout(dto);
  }

  @Post('checkout/:orderId/confirm')
  confirm(@Param('orderId') orderId: string, @Body() dto: ConfirmPaymentDto) {
    return this.checkout.confirmPayment({ orderId, ...dto });
  }

  @Post('payments/webhook')
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    if (!signature || !req.rawBody) {
      throw new BadRequestException('Missing webhook signature or body');
    }
    const valid = verifyWebhookSignature({
      rawBody: req.rawBody,
      signature,
      webhookSecret: this.razorpay.webhookSecret,
    });
    if (!valid) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    return this.checkout.handleWebhookEvent(req.body);
  }
}
