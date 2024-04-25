import { Module } from '@nestjs/common';
import { UtilModule } from '../util/util.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OptimisticLockService } from './optimisticLock.service';

@Module({
  imports: [UtilModule, PrismaModule],
  providers: [OptimisticLockService],
})
export class OptimisticLockModule {}
