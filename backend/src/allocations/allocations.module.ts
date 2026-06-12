import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AllocationsController } from './allocations.controller';

@Module({
  imports: [AuthModule],
  controllers: [AllocationsController],
})
export class AllocationsModule {}
