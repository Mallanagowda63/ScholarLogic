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

  // A student's own login ID and password. Throws when the provider refuses, so the caller can report it.
  async sendLoginCredentialsEmail(to: string, name: string, loginId: string, password: string, siteUrl: string): Promise<string> {
    if (!this.transporter) await this.initTransporter();
    if (!this.transporter || this.providerType === 'ethereal') throw new Error('Email is not set up on the server (RESEND_API_KEY)');
    const esc = (v: string) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
    const loginUrl = `${siteUrl.replace(/\/+$/, '')}/login`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #1e293b;">
        <h2 style="color: #0c8ee9; margin: 0 0 16px;">ScholarLogic</h2>
        <p>Dear <strong>${esc(name)}</strong>,</p>
        <p>Your ScholarLogic student login is ready. Use these details to sign in:</p>
        <table style="background: #f1f5f9; border-radius: 10px; padding: 14px 18px; margin: 16px 0; font-size: 15px;">
          <tr><td style="color: #64748b; padding: 4px 16px 4px 0;">Website</td><td><a href="${esc(loginUrl)}" style="color: #0c8ee9;">${esc(loginUrl)}</a></td></tr>
          <tr><td style="color: #64748b; padding: 4px 16px 4px 0;">Login ID</td><td style="font-family: monospace; font-weight: bold;">${esc(loginId)}</td></tr>
          <tr><td style="color: #64748b; padding: 4px 16px 4px 0;">Password</td><td style="font-family: monospace; font-weight: bold;">${esc(password)}</td></tr>
        </table>
        <p><a href="${esc(loginUrl)}" style="display: inline-block; background: #0c8ee9; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: bold;">Log in to ScholarLogic</a></p>
        <p style="font-size: 13px; color: #64748b;">Keep this password private. If you did not expect this email, contact the ScholarLogic office.</p>
        <p>Regards,<br/>ScholarLogic Team</p>
      </div>`;
    const text = `Dear ${name},\n\nYour ScholarLogic student login:\nWebsite: ${loginUrl}\nLogin ID: ${loginId}\nPassword: ${password}\n\nKeep this password private.\n\nScholarLogic Team`;
    const info = await this.transporter.sendMail({
      from: process.env.EMAIL_FROM || 'ScholarLogic <noreply@scholarlogiclms.in>',
      to,
      subject: 'Your ScholarLogic login details',
      html,
      text,
    });
    return String(info.messageId || '');
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
