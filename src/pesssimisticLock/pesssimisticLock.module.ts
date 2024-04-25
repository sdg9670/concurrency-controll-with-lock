import { Module } from '@nestjs/common';
import { UtilModule } from '../util/util.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PesssimisticLockService } from './pesssimisticLock.service';

@Module({
  imports: [UtilModule, PrismaModule],
  providers: [PesssimisticLockService],
})
export class PesssimisticLockModule {}
