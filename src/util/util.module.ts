import { Module } from '@nestjs/common';
import { UtilService } from './util.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [UtilService],
  exports: [UtilService],
})
export class UtilModule {}
