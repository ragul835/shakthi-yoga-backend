import * as nodemailer from 'nodemailer';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ContactService } from './contact.service';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

describe('ContactService reply', () => {
  const originalEnv = process.env;
  const prisma = {
    contactMessage: { findUnique: jest.fn(), update: jest.fn() },
  };
  const sendMail = jest.fn();
  let service: ContactService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, SMTP_HOST: 'smtp.example.com', SMTP_USER: 'studio@example.com', SMTP_PASS: 'secret' };
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
    prisma.contactMessage.findUnique.mockResolvedValue({ id: 'message-1', name: 'Student', email: 'student@example.com' });
    prisma.contactMessage.update.mockResolvedValue({});
    sendMail.mockResolvedValue({ messageId: 'smtp-message-1' });
    service = new ContactService(prisma as never);
  });

  afterAll(() => { process.env = originalEnv; });

  it('sends to the stored contact address and marks the message read after delivery', async () => {
    await service.reply('message-1', { subject: 'Re: Classes', message: 'Happy to help.' }, 'admin-1');

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'student@example.com',
      subject: 'Re: Classes',
      text: expect.stringContaining('Happy to help.'),
    }));
    expect(prisma.contactMessage.update).toHaveBeenCalledWith({
      where: { id: 'message-1' },
      data: { isRead: true, readById: 'admin-1' },
    });
  });

  it('does not allow a missing contact message', async () => {
    prisma.contactMessage.findUnique.mockResolvedValue(null);
    await expect(service.reply('missing', { subject: 'Reply', message: 'Hello' }, 'admin-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('fails clearly when SMTP is not configured', async () => {
    delete process.env.SMTP_HOST;
    await expect(service.reply('message-1', { subject: 'Reply', message: 'Hello' }, 'admin-1')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(sendMail).not.toHaveBeenCalled();
  });
});
