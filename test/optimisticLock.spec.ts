import { Test, TestingModule } from '@nestjs/testing';
import { UtilService } from '../src/util/util.service';
import { OptimisticLockModule } from '../src/optimisticLock/optimisticLock.module';
import { OptimisticLockService } from '../src/optimisticLock/optimisticLock.service';

describe('OptimisticLock', () => {
  let service: OptimisticLockService;
  let utilService: UtilService;
  let module: TestingModule;
  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [OptimisticLockModule],
    }).compile();
    await module.init();

    utilService = module.get<UtilService>(UtilService);
    service = module.get<OptimisticLockService>(OptimisticLockService);

    await utilService.clearDatas();
  });

  afterEach(async () => {
    await module.close();
  });

  it('잔여태켓 100개, 1000번 구매 시도 (OptimisticLock)', async () => {
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
