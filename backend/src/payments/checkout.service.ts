import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OrderStatus,
  OrderType,
  PaymentStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { verifyPaymentSignature } from './razorpay-signature';
import { RazorpayService } from './razorpay.service';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayService,
    private readonly config: ConfigService,
  ) {}

  private async nextOrderNo(): Promise<string> {
    const count = await this.prisma.order.count();
    return `ORD-${String(count + 1).padStart(6, '0')}`;
  }

  private async findOrCreateCustomer(input: {
    phone: string;
    name: string;
    address?: string;
    pincode?: string;
    city?: string;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { phone: input.phone },
      include: { customer: true },
    });
    if (user) {
      if (user.role !== Role.CUSTOMER || !user.customer) {
        throw new BadRequestException(
          'This phone number belongs to a staff account',
        );
      }
      return user.customer;
    }
    const count = await this.prisma.customer.count();
    return this.prisma.customer.create({
      data: {
        customerNo: `AW-${String(count + 1).padStart(6, '0')}`,
        address: input.address,
        pincode: input.pincode,
        city: input.city,
        user: {
          create: { phone: input.phone, name: input.name, role: Role.CUSTOMER },
        },
      },
    });
  }

  // Storefront checkout: creates customer (if new), order, and gateway order.
  async createCheckout(input: {
    name: string;
    phone: string;
    address?: string;
    pincode?: string;
    city?: string;
    items: { productId: string; qty: number }[];
  }) {
    const products = await this.prisma.product.findMany({
      where: { id: { in: input.items.map((i) => i.productId) }, active: true },
    });
    if (products.length !== new Set(input.items.map((i) => i.productId)).size) {
      throw new NotFoundException('One or more products were not found');
    }

    const items = input.items.map((i) => {
      const product = products.find((p) => p.id === i.productId)!;
      return { productId: i.productId, qty: i.qty, priceInr: product.priceInr };
    });
    const amountInr = items.reduce(
      (sum, i) => sum + Number(i.priceInr) * i.qty,
      0,
    );

    const customer = await this.findOrCreateCustomer(input);
    const orderNo = await this.nextOrderNo();
    const gateway = await this.razorpay.createOrder(amountInr, orderNo);

    const order = await this.prisma.order.create({
      data: {
        orderNo,
        customerId: customer.id,
        type: OrderType.PRODUCT,
        amountInr: new Prisma.Decimal(amountInr),
        razorpayOrderId: gateway.razorpayOrderId,
        items: { create: items },
        payments: {
          create: { amountInr: new Prisma.Decimal(amountInr) },
        },
      },
    });

    return {
      orderId: order.id,
      orderNo: order.orderNo,
      amountInr,
      customerNo: customer.customerNo,
      razorpay: gateway,
    };
  }

  // Browser callback after Razorpay checkout completes. The webhook is the
  // authoritative confirmation; this gives the user instant feedback after
  // signature verification with the key secret.
  async confirmPayment(input: {
    orderId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    const order = await this.prisma.order.findUnique({
      where: { id: input.orderId },
      include: { payments: true },
    });
    if (!order || order.razorpayOrderId !== input.razorpayOrderId) {
      throw new NotFoundException('Order not found');
    }
    if (order.status === OrderStatus.PAID) {
      return { orderNo: order.orderNo, status: order.status };
    }

    const isDevOrder = input.razorpayOrderId.startsWith('order_dev_');
    const devBypass =
      isDevOrder &&
      !this.razorpay.isConfigured &&
      this.config.get('NODE_ENV') !== 'production';

    if (!devBypass) {
      const valid = verifyPaymentSignature({
        razorpayOrderId: input.razorpayOrderId,
        razorpayPaymentId: input.razorpayPaymentId,
        signature: input.razorpaySignature,
        keySecret: this.razorpay.keySecret,
      });
      if (!valid) {
        throw new UnauthorizedException('Invalid payment signature');
      }
    }

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.PAID,
        payments: {
          update: {
            where: { id: order.payments[0].id },
            data: {
              status: PaymentStatus.CAPTURED,
              razorpayPaymentId: input.razorpayPaymentId,
              signature: input.razorpaySignature,
            },
          },
        },
      },
    });
    return { orderNo: updated.orderNo, status: updated.status };
  }

  // Authoritative webhook handler (idempotent).
  async handleWebhookEvent(event: {
    event: string;
    payload?: {
      payment?: { entity?: { id?: string; order_id?: string } };
    };
  }) {
    const entity = event.payload?.payment?.entity;
    if (!entity?.order_id) return { handled: false };

    const order = await this.prisma.order.findUnique({
      where: { razorpayOrderId: entity.order_id },
      include: { payments: true },
    });
    if (!order) return { handled: false };

    if (event.event === 'payment.captured') {
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.PAID,
          payments: {
            update: {
              where: { id: order.payments[0].id },
              data: {
                status: PaymentStatus.CAPTURED,
                razorpayPaymentId: entity.id,
                webhookPayload: event as object,
              },
            },
          },
        },
      });
      return { handled: true };
    }

    if (event.event === 'payment.failed' && order.status !== OrderStatus.PAID) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.FAILED,
          payments: {
            update: {
              where: { id: order.payments[0].id },
              data: {
                status: PaymentStatus.FAILED,
                razorpayPaymentId: entity.id,
                webhookPayload: event as object,
              },
            },
          },
        },
      });
      return { handled: true };
    }

    return { handled: false };
  }
}
