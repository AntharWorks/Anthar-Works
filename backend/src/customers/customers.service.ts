import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

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
}
