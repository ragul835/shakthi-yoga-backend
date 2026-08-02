import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { SendCampaignDto } from './dto/newsletter.dto';

@Injectable()
export class NewsletterService {
  constructor(private prisma: PrismaService) {}

  async subscribe(rawEmail: string) {
    const email = rawEmail.trim().toLowerCase();
    const confirmToken = randomBytes(32).toString('hex');
    const unsubscribeToken = randomBytes(32).toString('hex');
    const existing = await this.prisma.newsletterSubscriber.findUnique({ where: { email } });
    if (existing?.status === 'ACTIVE') return { message: 'You are already subscribed.' };
    const subscriber = await this.prisma.newsletterSubscriber.upsert({
      where: { email },
      create: { email, confirmToken, unsubscribeToken },
      update: { status: 'PENDING', confirmToken, unsubscribeToken, consentedAt: new Date(), unsubscribedAt: null },
    });
    await this.sendConfirmation(subscriber.email, confirmToken);
    return { message: 'Check your email to confirm your subscription.' };
  }

  async confirm(token: string) {
    const subscriber = await this.prisma.newsletterSubscriber.findUnique({ where: { confirmToken: token } });
    if (!subscriber) throw new BadRequestException('Invalid or expired confirmation link');
    await this.prisma.newsletterSubscriber.update({ where: { id: subscriber.id }, data: { status: 'ACTIVE', confirmedAt: new Date(), confirmToken: null } });
    return { message: 'Your subscription is confirmed.' };
  }

  async unsubscribe(token: string) {
    const subscriber = await this.prisma.newsletterSubscriber.findUnique({ where: { unsubscribeToken: token } });
    if (!subscriber) throw new BadRequestException('Invalid unsubscribe link');
    await this.prisma.newsletterSubscriber.update({ where: { id: subscriber.id }, data: { status: 'UNSUBSCRIBED', unsubscribedAt: new Date() } });
    return { message: 'You have been unsubscribed.' };
  }

  findAll() { return this.prisma.newsletterSubscriber.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, email: true, status: true, consentedAt: true, confirmedAt: true, unsubscribedAt: true } }); }

  async sendCampaign(dto: SendCampaignDto) {
    const subscribers = await this.prisma.newsletterSubscriber.findMany({ where: { status: 'ACTIVE' } });
    const transporter = this.transporter();
    const frontend = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0];
    const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
    for (const subscriber of subscribers) {
      await transporter.sendMail({ from: `"Shakthi Yoga" <${process.env.SMTP_USER}>`, to: subscriber.email, subject: dto.subject, html: `<div style="font:16px/1.7 Arial;color:#2c2c2c;max-width:640px;margin:auto"><h1 style="color:#557a5b">SHAKTHI YOGA</h1><div style="white-space:pre-wrap">${escape(dto.message)}</div><hr><p style="font-size:12px"><a href="${frontend}/newsletter?unsubscribe=${subscriber.unsubscribeToken}">Unsubscribe</a></p></div>` });
    }
    return { sent: subscribers.length };
  }

  private async sendConfirmation(email: string, token: string) {
    const frontend = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0];
    await this.transporter().sendMail({ from: `"Shakthi Yoga" <${process.env.SMTP_USER}>`, to: email, subject: 'Confirm your Shakthi Yoga newsletter subscription', html: `<p>Please confirm your subscription:</p><p><a href="${frontend}/newsletter?confirm=${token}">Confirm subscription</a></p><p>If you did not request this, ignore this email.</p>` });
  }

  private transporter() {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) throw new ServiceUnavailableException('Newsletter email delivery is not configured');
    return nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_PORT === '465', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  }
}
