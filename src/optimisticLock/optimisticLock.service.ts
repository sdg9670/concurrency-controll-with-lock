import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UtilService } from '../util/util.service';

@Injectable()
export class OptimisticLockService {
  constructor(
    private readonly utilService: UtilService,
    private readonly prismaService: PrismaService,
  ) {}

  async buyTicket({ ticketId, userId }: { ticketId: number; userId: number }) {
    let affectedRows: number = 0;
    let retryCount = 0; // 재시도 횟수 제한

    while (affectedRows === 0 && retryCount < 100) {
      retryCount++;

      // 티켓 조회
      const [ticket] = await this.prismaService.$queryRaw<
        { quantity: number }[]
      >`SELECT quantity FROM Ticket WHERE id = ${ticketId}`;

      // 잔여 수량이 없으면 에러 발생
      if (ticket.quantity <= 0) {
        throw new Error('Ticket sold out');
      }

      // 해당 티켓에 조회한 잔여 수량이 있으면 잔여수량 감소
      affectedRows = await this.prismaService
        .$executeRaw`UPDATE Ticket SET quantity = ${ticket.quantity} - 1 WHERE id = ${ticketId} AND quantity = ${ticket.quantity}`;

      // 티켓이 확인 안되면 재시도 (잦은 재시도로 인한 부하 방지)
      if (affectedRows === 0) {
        await this.utilService.sleep(100 + Math.random() * 400);
        continue;
      }

      try {
        // 유저 티켓 생성
        await this.prismaService
          .$executeRaw`INSERT INTO UserTicket (userId, ticketId, quantity) VALUES (${userId}, ${ticketId}, ${ticket.quantity})`;

        // 1/10 확률로 오류 발생
        if (this.utilService.getRandom(9) === 9) {
          throw new Error('Random error');
        }
      } catch (e) {
        // 오류 발생시 롤백
        // 복구하는 사이에 다른 트랜잭션이 해당 데이터를 수정할 수 있다.
        // 원자성을 보장하는 연산으로만 복구 가능함
        await this.prismaService
          .$executeRaw`UPDATE Ticket SET quantity = quantity + 1 WHERE id = ${ticketId}`;
        await this.prismaService
          .$executeRaw`DELETE FROM UserTicket WHERE userId = ${userId} AND ticketId = ${ticketId} AND quantity = ${ticket.quantity}`;
        throw e;
      }
    }
  }
}
