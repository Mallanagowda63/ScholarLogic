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
    const replyTo = process.env.EMAIL_REPLY_TO || 'tech@scholarlogic.net';
    const font = "font-family: 'Segoe UI', Arial, Helvetica, sans-serif;";
    const row = (label: string, value: string, mono = true) => `
              <tr>
                <td style="${font} padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px; width: 110px;">${label}</td>
                <td style="${mono ? "font-family: Consolas, 'Courier New', monospace;" : font} padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 16px; font-weight: bold;">${value}</td>
              </tr>`;
    // Table layout with inline styles: renders the same in Gmail, Outlook and phone mail apps
    const html = `<!doctype html>
<html><body style="margin: 0; padding: 0; background: #f1f5f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f1f5f9; padding: 24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 2px 8px rgba(15,23,42,0.06);">
        <tr>
          <td style="background: #0c8ee9; background-image: linear-gradient(135deg, #0c8ee9, #4f46e5); padding: 26px 32px;">
            <p style="${font} margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: 0.3px;">ScholarLogic</p>
            <p style="${font} margin: 4px 0 0; color: #dbeafe; font-size: 13px;">Student Learning Portal</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 30px 32px 8px;">
            <p style="${font} margin: 0 0 14px; color: #0f172a; font-size: 16px;">Dear <strong>${esc(name)}</strong>,</p>
            <p style="${font} margin: 0 0 20px; color: #334155; font-size: 15px; line-height: 1.6;">Welcome to ScholarLogic! Your student account is ready. Use the login details below to sign in to the portal, where you can see your attendance, courses, tests and job openings.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 6px 20px;">
              ${row('Website', `<a href="${esc(loginUrl)}" style="color: #0c8ee9; text-decoration: none;">${esc(loginUrl.replace(/^https?:\/\//, ''))}</a>`, false)}
              ${row('Login ID', esc(loginId))}
              <tr>
                <td style="${font} padding: 10px 0; color: #64748b; font-size: 13px; width: 110px;">Password</td>
                <td style="font-family: Consolas, 'Courier New', monospace; padding: 10px 0; color: #0f172a; font-size: 16px; font-weight: bold;">${esc(password)}</td>
              </tr>
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 26px 0 8px;">
              <tr><td style="border-radius: 10px; background: #0c8ee9;">
                <a href="${esc(loginUrl)}" style="${font} display: inline-block; padding: 13px 30px; color: #ffffff; font-size: 15px; font-weight: bold; text-decoration: none;">Log in to ScholarLogic &rarr;</a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 32px 26px;">
            <p style="${font} margin: 0 0 6px; color: #0f172a; font-size: 14px; font-weight: bold;">How to log in</p>
            <ol style="${font} margin: 0 0 18px; padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.7;">
              <li>Open <a href="${esc(loginUrl)}" style="color: #0c8ee9;">${esc(loginUrl.replace(/^https?:\/\//, ''))}</a> on your phone or computer.</li>
              <li>Type your <strong>Login ID</strong> and <strong>Password</strong> exactly as shown above.</li>
              <li>Tap the eye icon to check the password before you sign in.</li>
            </ol>
            <p style="${font} margin: 0; padding: 12px 14px; background: #fef3c7; border-radius: 8px; color: #92400e; font-size: 13px; line-height: 1.5;">&#128274; Keep your password private. Do not share it with anyone. ScholarLogic staff will never ask for it.</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 18px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
            <p style="${font} margin: 0 0 4px; color: #475569; font-size: 13px;">Need help? Reply to this email or call <a href="tel:+919008625716" style="color: #0c8ee9; text-decoration: none;">+91 90086 25716</a>.</p>
            <p style="${font} margin: 0; color: #94a3b8; font-size: 12px;">Regards, ScholarLogic Team</p>
          </td>
        </tr>
      </table>
      <p style="${font} margin: 14px 0 0; color: #94a3b8; font-size: 11px;">You received this because you are a ScholarLogic student.</p>
    </td></tr>
  </table>
</body></html>`;
    const text = `Dear ${name},\n\nWelcome to ScholarLogic! Your student account is ready.\n\nWebsite:  ${loginUrl}\nLogin ID: ${loginId}\nPassword: ${password}\n\nHow to log in:\n1. Open ${loginUrl}\n2. Type your Login ID and Password exactly as shown above.\n\nKeep your password private. Do not share it with anyone.\n\nNeed help? Reply to this email or call +91 90086 25716.\n\nRegards,\nScholarLogic Team`;
    const info = await this.transporter.sendMail({
      from: process.env.EMAIL_FROM || 'ScholarLogic <noreply@scholarlogiclms.in>',
      replyTo,
      to,
      subject: `${name.split(' ')[0] || 'Student'}, your ScholarLogic login details`,
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
