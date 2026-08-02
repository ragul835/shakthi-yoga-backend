import { Injectable, ConflictException, UnauthorizedException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto, ForgotPasswordDto, ResetPasswordDto } from './dto/auth.dto';
import { Role } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email.toLowerCase(),
        passwordHash,
        phone: dto.phone,
        dob: dto.dob ? new Date(dto.dob) : undefined,
        experienceLevel: dto.experienceLevel || 'BEGINNER',
        practiceFrequency: dto.practiceFrequency,
        healthNotes: dto.healthNotes,
        emergencyContactName: dto.emergencyContactName,
        emergencyContactPhone: dto.emergencyContactPhone,
        purposeOfJoining: dto.purposeOfJoining || [],
        physicalHealth: dto.physicalHealth,
        mentalHealth: dto.mentalHealth,
        digitalMediaWaiver: dto.digitalMediaWaiver,
        liabilityWaiver: dto.liabilityWaiver,
        role: Role.STUDENT,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      user,
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Your account has been deactivated. Please contact support.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Save refresh token
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: await bcrypt.hash(tokens.refreshToken, 10) },
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profilePhotoUrl: user.profilePhotoUrl,
      },
      ...tokens,
    };
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Access denied');
    }

    const isRefreshTokenValid = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('Access denied');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: await bcrypt.hash(tokens.refreshToken, 10) },
    });

    return tokens;
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    return { message: 'Logged out successfully' };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        dob: true,
        experienceLevel: true,
        role: true,
        profilePhotoUrl: true,
        healthNotes: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return user;
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    
    if (!user) {
      // Return success even if user not found to prevent email enumeration
      return { message: 'If an account exists, a reset link has been sent' };
    }

    // Snippet of the current password hash, e.g., last 10 chars
    const hashSnippet = user.passwordHash.slice(-10);
    const payload = { sub: user.id, hash: hashSnippet };
    
    // Token expires in 15m
    const resetSecret = process.env.JWT_RESET_SECRET || process.env.JWT_SECRET;
    if (!resetSecret) {
      throw new ServiceUnavailableException(
        'Password reset is temporarily unavailable',
      );
    }
    const resetToken = await this.jwtService.signAsync(payload, {
      expiresIn: '15m',
      secret: resetSecret,
    });
    
    const frontendUrls = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',');
    const frontendUrl = frontendUrls[0].trim();
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;
    
    await this.sendResetEmail(user.email, resetLink);
    
    return { message: 'If an account exists, a reset link has been sent' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    let payload;
    try {
      const resetSecret = process.env.JWT_RESET_SECRET || process.env.JWT_SECRET;
      if (!resetSecret) throw new Error('Reset secret is not configured');
      payload = await this.jwtService.verifyAsync<{ sub: string; hash: string }>(
        dto.token,
        { secret: resetSecret },
      );
    } catch {
      throw new BadRequestException('Invalid or expired reset token');
    }
    
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    
    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }
    
    const currentHashSnippet = user.passwordHash.slice(-10);
    if (currentHashSnippet !== payload.hash) {
      throw new BadRequestException('Token has already been used');
    }
    
    const newPasswordHash = await bcrypt.hash(dto.newPassword, 12);
    
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });
    
    return { message: 'Password has been reset successfully' };
  }

  private async sendResetEmail(to: string, resetLink: string) {
    let transporter;
    
    if (process.env.SMTP_HOST) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      // Fallback to ethereal for dev
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }
    
    const fromAddress = process.env.SMTP_USER || 'noreply@shakthiyoga.com';
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            background-color: #FAF9F6;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
            border: 1px solid #EAE7DF;
          }
          .header {
            background-color: #557A5B;
            padding: 40px 20px;
            text-align: center;
            color: #ffffff;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 500;
            letter-spacing: 1px;
            font-family: Georgia, serif;
          }
          .content {
            padding: 40px;
            color: #2C2C2C;
            line-height: 1.6;
          }
          .content p {
            font-size: 16px;
            margin-bottom: 24px;
            color: #5A544C;
          }
          .btn-container {
            text-align: center;
            margin: 35px 0;
          }
          .btn {
            display: inline-block;
            background-color: #557A5B;
            color: #ffffff;
            text-decoration: none;
            padding: 14px 32px;
            border-radius: 50px;
            font-weight: 600;
            font-size: 16px;
            transition: background-color 0.3s ease;
          }
          .btn:hover {
            background-color: #48684d;
          }
          .footer {
            background-color: #F4F3ED;
            padding: 24px;
            text-align: center;
            font-size: 13px;
            color: #8F887C;
            border-top: 1px solid #EAE7DF;
          }
          .link-fallback {
            font-size: 14px;
            color: #8F887C;
            word-break: break-all;
            margin-top: 24px;
            padding-top: 24px;
            border-top: 1px dashed #EAE7DF;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>SHAKTHI YOGA</h1>
          </div>
          <div class="content">
            <h2 style="color: #2C2C2C; font-size: 22px; margin-top: 0; font-family: Georgia, serif;">Password Reset Request</h2>
            <p>We received a request to reset your password for your Shakthi Yoga account. Don't worry, we've got you covered!</p>
            <p>Click the button below to choose a new password. This link is valid for the next <strong>15 minutes</strong>.</p>
            
            <div class="btn-container">
              <a href="${resetLink}" class="btn" style="color: #ffffff;">Reset My Password</a>
            </div>
            
            <p style="margin-bottom: 0;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
            
            <div class="link-fallback">
              Or copy and paste this link into your browser:<br>
              <a href="${resetLink}" style="color: #557A5B;">${resetLink}</a>
            </div>
          </div>
          <div class="footer">
            <p style="margin: 0;">&copy; ${new Date().getFullYear()} Shakthi Yoga. All rights reserved.</p>
            <p style="margin: 5px 0 0 0;">Your journey to wellness begins with a single breath.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const info = await transporter.sendMail({
      from: `"Shakthi Yoga" <${fromAddress}>`,
      to,
      subject: 'Reset Your Shakthi Yoga Password',
      text: `Please click this link to reset your password: ${resetLink}. The link expires in 15 minutes.`,
      html: emailHtml,
    });
    
    if (!process.env.SMTP_HOST) {
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };
    const accessExpiry = process.env.JWT_ACCESS_EXPIRATION || '15m';
    const refreshExpiry = process.env.JWT_REFRESH_EXPIRATION || '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn: accessExpiry } as any),
      this.jwtService.signAsync(payload, { expiresIn: refreshExpiry } as any),
    ]);

    return { accessToken, refreshToken };
  }
}
