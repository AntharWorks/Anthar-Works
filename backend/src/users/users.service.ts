import { ConflictException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // Admin creates logins for Backend staff & Technicians; phone is the login id.
  async createStaffLogin(input: { phone: string; name: string; role: Role }) {
    const existing = await this.prisma.user.findUnique({
      where: { phone: input.phone },
    });
    if (existing) {
      throw new ConflictException('A user with this phone already exists');
    }
    return this.prisma.user.create({ data: input });
  }

  findAll(role?: Role) {
    return this.prisma.user.findMany({
      where: role ? { role } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }
}
