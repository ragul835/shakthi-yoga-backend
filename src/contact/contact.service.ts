import { Injectable, NotFoundException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto } from './dto/contact.dto';

@Injectable()
export class ContactService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateContactDto) {
    const message = await this.prisma.contactMessage.create({ data: dto });
    
    // Send email asynchronously without blocking the response
    this.sendContactEmails(dto).catch(err => {
      console.error('Failed to send contact emails:', err);
    });
    
    return message;
  }

  private async sendContactEmails(dto: CreateContactDto) {
    if (!process.env.SMTP_HOST) return;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const fromAddress = process.env.SMTP_USER || 'noreply@shakthiyoga.com';
    const adminEmail = process.env.SMTP_USER; // Send notification to the SMTP user

    // Base styles for both templates
    const emailStyles = `
      body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #FAF9F6; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
      .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #EAE7DF; }
      .header { background-color: #557A5B; padding: 40px 20px; text-align: center; color: #ffffff; }
      .header h1 { margin: 0; font-size: 28px; font-weight: 500; letter-spacing: 1px; font-family: Georgia, serif; }
      .content { padding: 40px; color: #2C2C2C; line-height: 1.6; }
      .content p { font-size: 16px; margin-bottom: 20px; color: #5A544C; }
      .data-box { background-color: #FAF9F6; border-radius: 8px; padding: 20px; margin: 24px 0; border: 1px solid #EAE7DF; }
      .data-row { margin-bottom: 12px; font-size: 15px; }
      .data-label { font-weight: 600; color: #2C2C2C; display: inline-block; width: 80px; }
      .data-value { color: #5A544C; }
      .message-box { background-color: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #EAE7DF; margin-top: 16px; font-style: italic; color: #5A544C; }
      .footer { background-color: #F4F3ED; padding: 24px; text-align: center; font-size: 13px; color: #8F887C; border-top: 1px solid #EAE7DF; }
    `;

    // 1. Notify Admin
    if (adminEmail) {
      await transporter.sendMail({
        from: `"Shakthi Yoga Website" <${fromAddress}>`,
        to: adminEmail,
        replyTo: dto.email,
        subject: `New Contact Request: ${dto.subject}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>${emailStyles}</style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>NEW INQUIRY</h1>
              </div>
              <div class="content">
                <h2 style="color: #2C2C2C; font-size: 22px; margin-top: 0; font-family: Georgia, serif;">Website Contact Form</h2>
                <p>You have received a new message from the Shakthi Yoga website.</p>
                
                <div class="data-box">
                  <div class="data-row">
                    <span class="data-label">Name:</span> 
                    <span class="data-value">${dto.name}</span>
                  </div>
                  <div class="data-row">
                    <span class="data-label">Email:</span> 
                    <span class="data-value"><a href="mailto:${dto.email}" style="color: #557A5B;">${dto.email}</a></span>
                  </div>
                  
                  <div style="margin-top: 24px; font-weight: 600; color: #2C2C2C;">Message:</div>
                  <div class="message-box">
                    ${dto.message.replace(/\n/g, '<br/>')}
                  </div>
                </div>
                
                <p style="font-size: 14px; margin-bottom: 0;"><em>Reply directly to this email to respond to ${dto.name}.</em></p>
              </div>
              <div class="footer">
                <p style="margin: 0;">Automated notification from Shakthi Yoga Website</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });
    }

    // 2. Auto-reply to User
    await transporter.sendMail({
      from: `"Shakthi Yoga" <${fromAddress}>`,
      to: dto.email,
      subject: 'Thank you for getting in touch!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>${emailStyles}</style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>SHAKTHI YOGA</h1>
            </div>
            <div class="content">
              <h2 style="color: #2C2C2C; font-size: 22px; margin-top: 0; font-family: Georgia, serif;">Thank you for reaching out!</h2>
              <p>Hi ${dto.name},</p>
              <p>We've successfully received your message. Thank you for your interest in Shakthi Yoga.</p>
              
              <div class="data-box" style="text-align: center; padding: 32px 20px;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#557A5B" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px;">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <p style="margin: 0; color: #2C2C2C; font-weight: 500;">Our team will review your message and get back to you as soon as possible.</p>
              </div>
              
              <p>In the meantime, feel free to explore our <a href="${process.env.FRONTEND_URL?.split(',')[0] || 'http://localhost:3000'}/classes" style="color: #557A5B; font-weight: 500;">class schedules</a> or read more <a href="${process.env.FRONTEND_URL?.split(',')[0] || 'http://localhost:3000'}/about" style="color: #557A5B; font-weight: 500;">about our studio</a>.</p>
              
              <br/>
              <p style="margin-bottom: 4px;">Namaste,</p>
              <p style="font-weight: 600; color: #2C2C2C; margin-top: 0;">The Shakthi Yoga Team</p>
            </div>
            <div class="footer">
              <p style="margin: 0;">&copy; ${new Date().getFullYear()} Shakthi Yoga. All rights reserved.</p>
              <p style="margin: 5px 0 0 0;">Your journey to wellness begins with a single breath.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
  }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [messages, total] = await Promise.all([
      this.prisma.contactMessage.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.contactMessage.count(),
    ]);
    return { data: messages, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async markAsRead(id: string, readById: string) {
    return this.prisma.contactMessage.update({
      where: { id },
      data: { isRead: true, readById },
    });
  }

  async deleteMessage(id: string) {
    const msg = await this.prisma.contactMessage.findUnique({ where: { id } });
    if (!msg) throw new NotFoundException('Message not found');
    return this.prisma.contactMessage.delete({ where: { id } });
  }
}
