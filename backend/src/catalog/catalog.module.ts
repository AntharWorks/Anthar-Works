import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlansController } from './plans.controller';
import { ProductsController } from './products.controller';

@Module({
  imports: [AuthModule],
  controllers: [ProductsController, PlansController],
})
export class CatalogModule {}
