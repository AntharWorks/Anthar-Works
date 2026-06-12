import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BillingPeriod,
  Role,
  SubscriptionStatus,
  WarrantyType,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const PERIOD_MONTHS: Record<BillingPeriod, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  HALF_YEARLY: 6,
  YEARLY: 12,
};

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async nextCustomerNo(): Promise<string> {
    const count = await this.prisma.customer.count();
    return `AW-${String(count + 1).padStart(6, '0')}`;
  }

  // Backend staff creates a unique customer id for every new purchase.
  async create(input: {
    phone: string;
    name: string;
    address?: string;
    pincode?: string;
    city?: string;
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { phone: input.phone },
    });
    if (existing) {
      throw new ConflictException('A user with this phone already exists');
    }
    const customerNo = await this.nextCustomerNo();
    return this.prisma.customer.create({
      data: {
        customerNo,
        address: input.address,
        pincode: input.pincode,
        city: input.city,
        user: {
          create: { phone: input.phone, name: input.name, role: Role.CUSTOMER },
        },
      },
      include: { user: true },
    });
  }

  async findAll(params: { q?: string; pincode?: string; page?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const take = 20;
    const where = {
      ...(params.pincode ? { pincode: params.pincode } : {}),
      ...(params.q
        ? {
            OR: [
              { customerNo: { contains: params.q, mode: 'insensitive' as const } },
              { user: { phone: { contains: params.q } } },
              { user: { name: { contains: params.q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        include: {
          user: true,
          subscriptions: { where: { status: 'ACTIVE' }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * take,
        take,
      }),
      this.prisma.customer.count({ where }),
    ]);
    return { items, total, page, pageSize: take };
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        user: true,
        devices: { include: { product: true } },
        subscriptions: { include: { plan: true }, orderBy: { createdAt: 'desc' } },
        tickets: { orderBy: { createdAt: 'desc' }, take: 20 },
        orders: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return customer;
  }

  // Register a purchased device; 1-year warranty per FRD complete purchases.
  async addDevice(
    customerId: string,
    input: { productId: string; purchaseDate: Date; warrantyType: WarrantyType },
  ) {
    const warrantyExpiry = new Date(input.purchaseDate);
    warrantyExpiry.setFullYear(warrantyExpiry.getFullYear() + 1);
    return this.prisma.customerDevice.create({
      data: { customerId, ...input, warrantyExpiry },
      include: { product: true },
    });
  }

  // Start a subscription for a customer (staff-registered purchase).
  async addSubscription(
    customerId: string,
    input: { planId: string; startDate?: Date },
  ) {
    const plan = await this.prisma.plan.findUniqueOrThrow({
      where: { id: input.planId },
    });
    const startDate = input.startDate ?? new Date();
    const nextRenewalAt = new Date(startDate);
    nextRenewalAt.setMonth(
      nextRenewalAt.getMonth() + PERIOD_MONTHS[plan.billingPeriod],
    );
    const subscription = await this.prisma.subscription.create({
      data: { customerId, planId: plan.id, startDate, nextRenewalAt },
      include: { plan: true, customer: { include: { user: true } } },
    });

    await this.notifications.sendBoth({
      recipient: subscription.customer.user.phone,
      template: 'SUBSCRIPTION_STARTED',
      message: `Welcome to Anthar Works! Your ${plan.name} subscription is active. Next renewal: ${nextRenewalAt.toLocaleDateString('en-IN')}.`,
      params: [plan.name, nextRenewalAt.toLocaleDateString('en-IN')],
      payload: { subscriptionId: subscription.id },
    });
    return subscription;
  }

  // FRD 1.2 granular control: manually flip a subscription's status.
  async setSubscriptionStatus(id: string, status: SubscriptionStatus) {
    return this.prisma.subscription.update({
      where: { id },
      data: { status },
      include: { plan: true },
    });
  }
}
