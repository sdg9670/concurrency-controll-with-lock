import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UtilModule } from '../util/util.module';
import { DistributedLockService } from './distributedLock.service';
import * as redis from 'redis';

@Module({
  imports: [UtilModule, PrismaModule],
  providers: [
    DistributedLockService,
    {
      provide: 'REDIS_CLIENT',
      useFactory: async () => {
        const client = redis.createClient({
          url: 'redis://localhost:6379',
        });
        return client;
      },
    },
    {
      provide: 'SUB_REDIS_CLIENT',
      useFactory: async () => {
        const client = redis.createClient({
          url: 'redis://localhost:6379',
        });
        return client;
      },
    },
  ],
})
export class DistributedLockModule {}
