import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UtilService } from '../util/util.service';

@Injectable()
export class PesssimisticLockService {
  constructor(
    private readonly utilService: UtilService,
    private readonly prismaService: PrismaService,
  ) {}

  async buyTicket({ ticketId, userId }: { ticketId: number; userId: number }) {
    // 하나의 트랜잭션으로 처리
    await this.prismaService.$transaction(async (prisma) => {
      // 티켓 조회 (X락)
      const [ticket] = await prisma.$queryRaw<
        { quantity: number }[]
      >`SELECT quantity FROM Ticket WHERE id = ${ticketId} FOR UPDATE`;

      // 잔여 수량이 없으면 에러 발생
      if (ticket.quantity <= 0) {
        throw new Error('Ticket sold out');
      }

      // 해당 티켓 잔여수량 감소
      await prisma.$executeRaw`UPDATE Ticket SET quantity = ${ticket.quantity} - 1 WHERE id = ${ticketId}`;

      // 유저 티켓 생성
      await prisma.$executeRaw`INSERT INTO UserTicket (userId, ticketId, quantity) VALUES (${userId}, ${ticketId}, ${ticket.quantity})`;

      // 1/10 확률로 오류 발생
      if (this.utilService.getRandom(9) === 9) {
        throw new Error('Random error');
      }
    });
  }
}
