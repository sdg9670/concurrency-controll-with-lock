import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import crypto from 'crypto';

@Injectable()
export class UtilService {
  constructor(private readonly prismaService: PrismaService) {}

  async sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async clearDatas() {
    await this.prismaService.ticket.deleteMany();
    await this.prismaService.userTicket.deleteMany();
  }

  async setTicket(id: number, quantity: number) {
    await this.prismaService.ticket.upsert({
      where: { id },
      update: { quantity },
      create: { id, quantity },
    });
  }

  async getUserTicketCount(ticketId: number) {
    return this.prismaService.userTicket.count({
      where: { ticketId },
    });
  }

  async getTicketQuantity(ticketId: number) {
    return (
      (await this.prismaService.ticket.findUnique({
        where: { id: ticketId },
      })) || { quantity: 0 }
    ).quantity;
  }

  getRandom(max: number): number {
    return crypto.randomInt(0, max);
  }
}
