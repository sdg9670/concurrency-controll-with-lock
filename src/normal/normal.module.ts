import { Module } from '@nestjs/common';
import { NormalService } from './normal.service';
import { UtilModule } from '../util/util.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [UtilModule, PrismaModule],
  providers: [NormalService],
})
export class NormalModule {}
