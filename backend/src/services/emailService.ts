import nodemailer from 'nodemailer';
import { env } from '../config/env';

export type EmailProviderType = 'resend' | 'sendgrid' | 'ses' | 'smtp' | 'ethereal';

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private providerType: EmailProviderType = 'ethereal';

  constructor() {
    this.initTransporter();
  }

  private async initTransporter() {
    try {
      const provider = process.env.EMAIL_PROVIDER?.toLowerCase() as EmailProviderType;

      if (provider === 'resend' && process.env.RESEND_API_KEY) {
        this.providerType = 'resend';
        this.transporter = nodemailer.createTransport({
          host: 'smtp.resend.com',
          port: 465,
          secure: true,
          auth: { user: 'resend', pass: process.env.RESEND_API_KEY },
        });
      } else if (provider === 'sendgrid' && process.env.SENDGRID_API_KEY) {
        this.providerType = 'sendgrid';
        this.transporter = nodemailer.createTransport({
          host: 'smtp.sendgrid.net',
          port: 587,
          secure: false,
          auth: { user: 'apikey', pass: process.env.SENDGRID_API_KEY },
        });
      } else if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        this.providerType = 'smtp';
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
      } else {
        this.providerType = 'ethereal';
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
      }
      console.log(`📧 EmailService initialized with adapter: [${this.providerType.toUpperCase()}]`);
    } catch (err) {
      console.warn('⚠️ Email Transporter initialization warning:', err);
    }
  }

  getProviderStatus(): { provider: EmailProviderType; isConfigured: boolean } {
    const isConfigured = this.providerType !== 'ethereal';
    return { provider: this.providerType, isConfigured };
  }

  async sendApplicationStatusEmail(
    studentEmail: string,
    studentName: string,
    companyName: string,
    jobTitle: string,
    newStatus: string
  ): Promise<boolean> {
    try {
      if (!this.transporter) await this.initTransporter();
      if (!this.transporter) return false;

      const subject = `ScholarLogic Placement Update: Application Status Changed to ${newStatus}`;
      const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #0c8ee9;">ScholarLogic Career & Placement Hub</h2>
          <p>Dear <strong>${studentName}</strong>,</p>
          <p>Your job application for <strong>${jobTitle}</strong> at <strong>${companyName}</strong> has been updated to:</p>
          <div style="background-color: #f1f5f9; padding: 15px; border-radius: 8px; font-size: 16px; font-weight: bold; color: #0f172a; margin: 15px 0;">
            Status: ${newStatus}
          </div>
          <p>Please log in to your ScholarLogic Student Portal to view next steps or interview schedules.</p>
          <br/>
          <p>Best regards,<br/>ScholarLogic Placement Office</p>
        </div>
      `;

      const fromAddress = process.env.EMAIL_FROM || '"ScholarLogic Placements" <placements@scholarlogic.edu>';

      const info = await this.transporter.sendMail({
        from: fromAddress,
        to: studentEmail,
        subject,
        html,
      });

      console.log(`📧 Email sent to ${studentEmail} via [${this.providerType.toUpperCase()}] (MsgId: ${info.messageId})`);
      return true;
    } catch (err: any) {
      console.warn(`⚠️ Email delivery alert:`, err.message);
      return true;
    }
  }
}

export const emailService = new EmailService();
