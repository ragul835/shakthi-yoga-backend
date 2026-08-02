import { BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service';

describe('AdminService CMS', () => {
  const siteContent = {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  };
  const auditLog = { create: jest.fn() };
  const prisma = {
    siteContent,
    auditLog,
    $transaction: jest.fn(async (callback: (tx: any) => unknown) => callback({ siteContent, auditLog })),
  } as any;
  const service = new AdminService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('returns a safe empty public response when content has not been published', async () => {
    siteContent.findUnique.mockResolvedValue(null);

    await expect(service.getPublicSiteContent('home')).resolves.toEqual({
      pageKey: 'home',
      content: null,
      updatedAt: null,
    });
  });

  it('rejects unsupported page keys', async () => {
    await expect(service.getPublicSiteContent('scripts')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('persists CMS content and writes an audit record atomically', async () => {
    const updatedAt = new Date('2026-08-02T12:00:00.000Z');
    siteContent.upsert.mockResolvedValue({ id: 'content-1', pageKey: 'home', updatedAt });
    auditLog.create.mockResolvedValue({ id: 'audit-1' });

    const result = await service.updateSiteContent(
      'home',
      { pageKey: 'home', content: '{"heroTitle":"Welcome"}' },
      'admin-1',
    );

    expect(result.content).toBe('{"heroTitle":"Welcome"}');
    expect(siteContent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { pageKey_sectionKey: { pageKey: 'home', sectionKey: 'main' } },
    }));
    expect(auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'admin-1', action: 'UPDATE_SITE_CONTENT' }),
    }));
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
