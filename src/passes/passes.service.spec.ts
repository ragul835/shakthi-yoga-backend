import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PassesService } from './passes.service';

describe('PassesService', () => {
  const prisma = {
    passOption: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const service = new PassesService(prisma as never);

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.ALLOW_SIMULATED_PASS_PURCHASES = 'false';
  });

  afterEach(() => {
    jest.resetAllMocks();
    delete process.env.ALLOW_SIMULATED_PASS_PURCHASES;
    delete process.env.NODE_ENV;
  });

  it('does not grant a pass when payments are not configured', async () => {
    await expect(service.purchasePass('user', 'option')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(prisma.passOption.findUnique).not.toHaveBeenCalled();
  });

  it('never allows simulated purchases in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_SIMULATED_PASS_PURCHASES = 'true';

    await expect(service.purchasePass('user', 'option')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('soft-deletes pass options that may have purchase history', async () => {
    prisma.passOption.findUnique.mockResolvedValue({ id: 'option' });
    prisma.passOption.update.mockResolvedValue({
      id: 'option',
      isActive: false,
    });

    await expect(service.deleteOption('option')).resolves.toMatchObject({
      isActive: false,
    });
    expect(prisma.passOption.update).toHaveBeenCalledWith({
      where: { id: 'option' },
      data: { isActive: false },
    });
  });

  it('returns not found when deleting an unknown pass option', async () => {
    prisma.passOption.findUnique.mockResolvedValue(null);
    await expect(service.deleteOption('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
