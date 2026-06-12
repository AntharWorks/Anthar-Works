import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BillingPeriod,
  OrderStatus,
  OrderType,
  PaymentStatus,
  Prisma,
  Role,
  SubscriptionStatus,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { TicketsService } from '../tickets/tickets.service';
import { verifyPaymentSignature } from './razorpay-signature';
import { RazorpayService } from './razorpay.service';

const PERIOD_MONTHS: Record<BillingPeriod, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  HALF_YEARLY: 6,
  YEARLY: 12,
};

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly tickets: TicketsService,
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
    return this.createOrderWithGateway({
      customerId: customer.id,
      customerNo: customer.customerNo,
      type: OrderType.PRODUCT,
      amountInr,
      items,
    });
  }

  // One-click subscription renewal (FRD 1.1) — order linked to the
  // subscription it extends on payment success.
  async createRenewal(userId: string, subscriptionId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { id: subscriptionId, customer: { userId } },
      include: { plan: true, customer: true },
    });
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
    return this.createOrderWithGateway({
      customerId: subscription.customerId,
      customerNo: subscription.customer.customerNo,
      type: OrderType.RENEWAL,
      amountInr: Number(subscription.plan.priceInr),
      subscriptionId: subscription.id,
    });
  }

  private async createOrderWithGateway(input: {
    customerId: string;
    customerNo: string;
    type: OrderType;
    amountInr: number;
    subscriptionId?: string;
    items?: { productId: string; qty: number; priceInr: Prisma.Decimal }[];
  }) {
    const orderNo = await this.nextOrderNo();
    const gateway = await this.razorpay.createOrder(input.amountInr, orderNo);

    const order = await this.prisma.order.create({
      data: {
        orderNo,
        customerId: input.customerId,
        type: input.type,
        amountInr: new Prisma.Decimal(input.amountInr),
        razorpayOrderId: gateway.razorpayOrderId,
        subscriptionId: input.subscriptionId,
        ...(input.items ? { items: { create: input.items } } : {}),
        payments: {
          create: { amountInr: new Prisma.Decimal(input.amountInr) },
        },
      },
    });

    return {
      orderId: order.id,
      orderNo: order.orderNo,
      amountInr: input.amountInr,
      customerNo: input.customerNo,
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

    const updated = await this.applyPaymentSuccess(order.id, {
      razorpayPaymentId: input.razorpayPaymentId,
      signature: input.razorpaySignature,
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
      if (order.status === OrderStatus.PAID) {
        // Already confirmed via browser callback; just record the webhook.
        await this.prisma.payment.update({
          where: { id: order.payments[0].id },
          data: { webhookPayload: event as object },
        });
        return { handled: true };
      }
      await this.applyPaymentSuccess(order.id, {
        razorpayPaymentId: entity.id,
        webhookPayload: event as object,
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

  /**
   * Single success path for both browser confirmation and webhook:
   * marks the order paid, extends the subscription for renewals, and fires
   * the FRD notification set (customer WhatsApp+SMS, company WhatsApp).
   */
  private async applyPaymentSuccess(
    orderId: string,
    payment: {
      razorpayPaymentId?: string;
      signature?: string;
      webhookPayload?: object;
    },
  ) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        payments: true,
        customer: { include: { user: true } },
        subscription: { include: { plan: true } },
      },
    });

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.PAID,
        payments: {
          update: {
            where: { id: order.payments[0].id },
            data: {
              status: PaymentStatus.CAPTURED,
              razorpayPaymentId: payment.razorpayPaymentId,
              signature: payment.signature,
              ...(payment.webhookPayload
                ? { webhookPayload: payment.webhookPayload }
                : {}),
            },
          },
        },
      },
    });

    if (order.type === OrderType.RENEWAL && order.subscription) {
      const months = PERIOD_MONTHS[order.subscription.plan.billingPeriod];
      const base =
        order.subscription.nextRenewalAt &&
        order.subscription.nextRenewalAt > new Date()
          ? order.subscription.nextRenewalAt
          : new Date();
      const next = new Date(base);
      next.setMonth(next.getMonth() + months);
      await this.prisma.subscription.update({
        where: { id: order.subscription.id },
        data: { status: SubscriptionStatus.ACTIVE, nextRenewalAt: next },
      });
    }

    // FRD: once payment is done the customer receives a ticket number for
    // installation scheduling.
    let installationTicketNo: string | null = null;
    if (order.type === OrderType.PRODUCT) {
      const ticket = await this.tickets.create({
        customerId: order.customerId,
        type: 'INSTALLATION',
        createdById: order.customer.user.id,
        slaDueAt: new Date(Date.now() + 72 * 3600 * 1000),
      });
      installationTicketNo = ticket.ticketNo;
    }

    const phone = order.customer.user.phone;
    const amount = `₹${Number(order.amountInr).toLocaleString('en-IN')}`;
    await this.notifications.sendBoth({
      recipient: phone,
      template:
        order.type === OrderType.RENEWAL ? 'RENEWAL_CONFIRMED' : 'ORDER_CONFIRMED',
      message:
        order.type === OrderType.RENEWAL
          ? `Payment of ${amount} received — your Anthar Works subscription is renewed. Order ${order.orderNo}.`
          : `Thanks for your purchase! Order ${order.orderNo} (${amount}) is confirmed.${
              installationTicketNo
                ? ` Your installation ticket is ${installationTicketNo} — we'll confirm the schedule shortly.`
                : ''
            }`,
      params: [order.orderNo, amount],
      payload: { orderId: order.id, installationTicketNo },
    });
    await this.notifications.notifyCompany(
      'NEW_ORDER_ALERT',
      `New ${order.type} order ${order.orderNo} — ${amount} from ${order.customer.user.name} (${order.customer.customerNo}, ${phone}).`,
      [order.orderNo, amount, order.customer.user.name],
    );

    return updated;
  }
}
