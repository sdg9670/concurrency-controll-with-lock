import { Test, TestingModule } from '@nestjs/testing';
import { UtilService } from '../src/util/util.service';
import { PesssimisticLockModule } from '../src/pesssimisticLock/pesssimisticLock.module';
import { PesssimisticLockService } from '../src/pesssimisticLock/pesssimisticLock.service';

describe('PesssimisticLock', () => {
  let service: PesssimisticLockService;
  let utilService: UtilService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PesssimisticLockModule],
    }).compile();
    await module.init();

    utilService = module.get<UtilService>(UtilService);
    service = module.get<PesssimisticLockService>(PesssimisticLockService);

    await utilService.clearDatas();
  });

  it('잔여태켓 100개, 1000번 구매 시도 (PesssimisticLock)', async () => {
    const ticketId = 1;
    const tryCount = 1000;
    const ticketQuantity = 100;
    await utilService.setTicket(ticketId, ticketQuantity);

    const requests: Promise<void>[] = [];
    for (let i = 0; i < tryCount; i++) {
      requests.push(service.buyTicket({ ticketId, userId: i }).catch(() => {}));
    }
    await Promise.all(requests);

    const count = await utilService.getUserTicketCount(ticketId);
    const quantity = await utilService.getTicketQuantity(ticketId);

    expect(count).toBe(ticketQuantity);
    expect(quantity).toBe(0);
  });
});
