import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AllocationsModule } from './allocations/allocations.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { CustomersModule } from './customers/customers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthController } from './health/health.controller';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { TicketsModule } from './tickets/tickets.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CustomersModule,
    CatalogModule,
    TicketsModule,
    DashboardModule,
    AllocationsModule,
    ReportsModule,
    PaymentsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
