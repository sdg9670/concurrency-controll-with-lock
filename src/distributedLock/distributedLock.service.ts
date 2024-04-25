import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UtilService } from '../util/util.service';
import { RedisClientType } from 'redis';
import {
  Subject,
  filter,
  take,
  firstValueFrom,
  timeout,
  throwError,
} from 'rxjs';

@Injectable()
export class DistributedLockService implements OnModuleInit, OnModuleDestroy {
  private readonly UNLOCK_CHANNEL = 'unlock';
  private unlockSubject: Subject<string>;

  constructor(
    private readonly utilService: UtilService,
    private readonly prismaService: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redisClient: RedisClientType,
    @Inject('SUB_REDIS_CLIENT')
    private readonly subRedisClient: RedisClientType,
  ) {
    this.unlockSubject = new Subject<string>();
  }

  async onModuleInit() {
    await this.subRedisClient.connect();
    await this.redisClient.connect();
    // 언락 채널 구독
    await this.subRedisClient.subscribe(this.UNLOCK_CHANNEL, (message) => {
      // 스트림 방식의 데이터를 처리하기 위해 rxjs 사용
      this.unlockSubject.next(message);
    });
  }

  async onModuleDestroy() {
    try {
      await this.subRedisClient.disconnect();
    } catch {}
    try {
      await this.redisClient.disconnect();
    } catch {}
  }

  async buyTicket({ ticketId, userId }: { ticketId: number; userId: number }) {
    const lockKey = `lock:buyTicket:${ticketId}`;
    let lockValue: string | null = null;
    try {
      // 락 획득
      lockValue = await this.tryLock(lockKey, 500, 30000);

      // 티켓 조회
      const [ticket] = await this.prismaService.$queryRaw<
        { quantity: number }[]
      >`SELECT quantity FROM Ticket WHERE id = ${ticketId}`;

      // 잔여 수량이 없으면 에러 발생
      if (ticket.quantity <= 0) {
        throw new Error('Ticket sold out');
      }

      // 해당 티켓에 조회한 잔여 수량이 있으면 잔여수량 감소
      await this.prismaService
        .$executeRaw`UPDATE Ticket SET quantity = ${ticket.quantity} - 1 WHERE id = ${ticketId} AND quantity = ${ticket.quantity}`;

      try {
        // 유저 티켓 생성
        await this.prismaService
          .$executeRaw`INSERT INTO UserTicket (userId, ticketId, quantity) VALUES (${userId}, ${ticketId}, ${ticket.quantity})`;

        // 1/10 확률로 오류 발생
        if (this.utilService.getRandom(9) === 9) {
          throw new Error('Random error');
        }
      } catch (e) {
        // 오류 발생시 롤백 (해당 로우에 대한 락을 이미 가지고 있으므로 원자성을 보장 안해도 됨)
        await this.prismaService
          .$executeRaw`UPDATE Ticket SET quantity = ${ticket.quantity} + 1 WHERE id = ${ticketId}`;
        await this.prismaService
          .$executeRaw`DELETE FROM UserTicket WHERE userId = ${userId} AND ticketId = ${ticketId} AND quantity = ${ticket.quantity}`;
        throw e;
      }
    } finally {
      if (lockValue !== null) {
        // 언락
        await this.unlock(lockKey, lockValue);
      }
    }
  }

  // 락 획득 시도
  private async tryLock(key: string, ttl: number, timeoutMs: number) {
    const value: string = new Date().getTime().toString();
    const startTime = new Date().getTime();

    // 락 시도 후 여부 반환
    const lock = async (key: string, ttl: number) => {
      const result = await this.redisClient.set(key, value, {
        NX: true,
        PX: ttl,
      });
      return result === 'OK';
    };

    // 락획득할 때까지 반복
    while ((await lock(key, ttl)) === false) {
      // 락 해제 메시지 대기
      await this.waitUnlock(key, ttl);

      // 타임아웃 체크
      if (new Date().getTime() - startTime > timeoutMs) {
        throw new Error('timeout');
      }
    }

    return value;
  }

  // 락 해제 대기
  private async waitUnlock(key: string, ttl: number) {
    try {
      await firstValueFrom(
        this.unlockSubject.pipe(
          filter((message) => message === key), // 락 키 값 필터
          timeout({
            each: ttl,
            with: () => throwError(() => new Error('timeout')),
          }), // ttl 동안 unlock 메시지가 오지 않으면 구독 중지
          take(1), // 1건 받으면 종료
        ),
      );
    } catch (e) {
      // ttl동안 unlock 메시지가 오지 않으면 재시도하기 위해 timeout 에러 무시
      // (구독 전에 락 해제 됬을 수도 있기 때문)
      if (e?.message !== 'timeout') {
        throw e;
      }
    }
  }

  // 언락
  private async unlock(key: string, value: string) {
    // 키와 값이 일치할 때만 삭제하는 Lua 스크립트
    const script = `
    if redis.call("get",KEYS[1]) == ARGV[1] then
        return redis.call("del",KEYS[1])
    else
        return 0
    end
    `;

    // 키 삭제
    const delCount = parseInt(
      (await this.redisClient.eval(script, {
        keys: [key],
        arguments: [value],
      })) as string,
    );

    if (delCount > 0) {
      // 키가 삭제된 경우만 언락 메시지 발행
      await this.redisClient.publish(this.UNLOCK_CHANNEL, key);
    }
  }
}
