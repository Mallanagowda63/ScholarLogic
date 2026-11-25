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

  // A change made by an admin (batch, subject, status, mode). Same look as the login email. Throws when the provider refuses.
  async sendStudentUpdateEmail(o: {
    to: string;
    name: string;
    subject: string;
    heading: string;
    intro: string;
    update: string;
    details?: string;
    rows: [string, string][];
    kind: 'good' | 'info' | 'warn';
    joinLink?: string;
    siteUrl: string;
  }): Promise<string> {
    if (!this.transporter) await this.initTransporter();
    if (!this.transporter || this.providerType === 'ethereal') throw new Error('Email is not set up on the server (RESEND_API_KEY)');
    const esc = (v: string) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
    const portal = `${o.siteUrl.replace(/\/+$/, '')}/login`;
    const font = "font-family: 'Segoe UI', Arial, Helvetica, sans-serif;";
    const tone = { good: ['#ecfdf5', '#047857', '#10b981'], info: ['#eff6ff', '#1d4ed8', '#3b82f6'], warn: ['#fffbeb', '#b45309', '#f59e0b'] }[o.kind];
    const rows = o.rows
      .map(
        ([label, value], i) => `
              <tr>
                <td style="${font} padding: 9px 0; ${i < o.rows.length - 1 ? 'border-bottom: 1px solid #e2e8f0;' : ''} color: #64748b; font-size: 13px; width: 110px;">${esc(label)}</td>
                <td style="${font} padding: 9px 0; ${i < o.rows.length - 1 ? 'border-bottom: 1px solid #e2e8f0;' : ''} color: #0f172a; font-size: 15px; font-weight: bold;">${esc(value)}</td>
              </tr>`
      )
      .join('');
    const html = `<!doctype html>
<html><body style="margin: 0; padding: 0; background: #f1f5f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f1f5f9; padding: 24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 2px 8px rgba(15,23,42,0.06);">
        <tr>
          <td style="background: #0c8ee9; background-image: linear-gradient(135deg, #0c8ee9, #4f46e5); padding: 24px 32px;">
            <p style="${font} margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: 0.3px;">ScholarLogic</p>
            <p style="${font} margin: 4px 0 0; color: #dbeafe; font-size: 13px;">Student Learning Portal</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 28px 32px 6px;">
            <p style="${font} margin: 0 0 6px; color: #0f172a; font-size: 20px; font-weight: 800;">${esc(o.heading)}</p>
            <p style="${font} margin: 0 0 16px; color: #0f172a; font-size: 15px;">Dear <strong>${esc(o.name)}</strong>,</p>
            <p style="${font} margin: 0 0 18px; color: #334155; font-size: 15px; line-height: 1.6;">${esc(o.intro)}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${tone[0]}; border-left: 4px solid ${tone[2]}; border-radius: 8px; margin: 0 0 18px;">
              <tr><td style="${font} padding: 12px 16px; color: ${tone[1]}; font-size: 15px; font-weight: bold;">${esc(o.update)}${o.details ? `<span style="display: block; margin-top: 4px; font-weight: normal; font-size: 13px; color: #475569;">${esc(o.details)}</span>` : ''}</td></tr>
            </table>
            ${o.rows.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 4px 20px;">${rows}
            </table>` : ''}
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0 8px;">
              <tr>
                ${o.joinLink ? `<td style="border-radius: 10px; background: #16a34a; padding-right: 0;"><a href="${esc(o.joinLink)}" style="${font} display: inline-block; padding: 12px 22px; color: #ffffff; font-size: 14px; font-weight: bold; text-decoration: none;">Join online class</a></td><td style="width: 10px;"></td>` : ''}
                <td style="border-radius: 10px; background: #0c8ee9;"><a href="${esc(portal)}" style="${font} display: inline-block; padding: 12px 22px; color: #ffffff; font-size: 14px; font-weight: bold; text-decoration: none;">Open my portal &rarr;</a></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 18px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
            <p style="${font} margin: 0 0 4px; color: #475569; font-size: 13px;">Questions? Reply to this email or call <a href="tel:+919008625716" style="color: #0c8ee9; text-decoration: none;">+91 90086 25716</a>.</p>
            <p style="${font} margin: 0; color: #94a3b8; font-size: 12px;">Regards, ScholarLogic Team</p>
          </td>
        </tr>
      </table>
      <p style="${font} margin: 14px 0 0; color: #94a3b8; font-size: 11px;">You received this because you are a ScholarLogic student.</p>
    </td></tr>
  </table>
</body></html>`;
    const text = [
      `Dear ${o.name},`,
      '',
      o.intro,
      '',
      o.update + (o.details ? ` (${o.details})` : ''),
      '',
      ...o.rows.map(([l, v]) => `${l}: ${v}`),
      ...(o.joinLink ? ['', `Join online class: ${o.joinLink}`] : []),
      '',
      `Open your portal: ${portal}`,
      '',
      'Questions? Reply to this email or call +91 90086 25716.',
      '',
      'Regards,',
      'ScholarLogic Team',
    ].join('\n');
    const info = await this.transporter.sendMail({
      from: process.env.EMAIL_FROM || 'ScholarLogic <noreply@scholarlogiclms.in>',
      replyTo: process.env.EMAIL_REPLY_TO || 'tech@scholarlogic.net',
      to: o.to,
      subject: o.subject,
      html,
      text,
    });
    return String(info.messageId || '');
  }

  // Welcome + course overview after registration: every subject in order, its length and main topics.
  async sendCourseOverviewEmail(o: {
    to: string;
    name: string;
    studentId: string;
    courseName: string;
    months: number;
    mode: string;
    subjects: { name: string; days: number; topics: string[]; topicCount: number }[];
    siteUrl: string;
    idCardFormUrl?: string; // registration verified: ask for the (mandatory) ID card form first
  }): Promise<string> {
    if (!this.transporter) await this.initTransporter();
    if (!this.transporter || this.providerType === 'ethereal') throw new Error('Email is not set up on the server (RESEND_API_KEY)');
    const esc = (v: string) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
    const portal = `${o.siteUrl.replace(/\/+$/, '')}/login`;
    const font = "font-family: 'Segoe UI', Arial, Helvetica, sans-serif;";
    const totalDays = o.subjects.reduce((s, x) => s + x.days, 0);
    const steps = o.subjects
      .map(
        (s, i) => `
              <tr>
                <td valign="top" style="padding: 10px 12px 10px 0; width: 34px;">
                  <div style="${font} width: 30px; height: 30px; line-height: 30px; border-radius: 15px; background: #0c8ee9; color: #ffffff; font-size: 13px; font-weight: bold; text-align: center;">${i + 1}</div>
                </td>
                <td valign="top" style="padding: 10px 0; ${i < o.subjects.length - 1 ? 'border-bottom: 1px solid #e2e8f0;' : ''}">
                  <p style="${font} margin: 0; color: #0f172a; font-size: 15px; font-weight: bold;">${esc(s.name)} <span style="font-weight: normal; color: #64748b; font-size: 12px;">&nbsp;• about ${s.days} days${s.topicCount ? ` • ${s.topicCount} topics` : ''}</span></p>
                  ${s.topics.length ? `<p style="${font} margin: 4px 0 0; color: #475569; font-size: 13px; line-height: 1.5;">${s.topics.map(esc).join(' &middot; ')}${s.topicCount > s.topics.length ? ' &middot; and more' : ''}</p>` : ''}
                </td>
              </tr>`
      )
      .join('');
    const html = `<!doctype html>
<html><body style="margin: 0; padding: 0; background: #f1f5f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f1f5f9; padding: 24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 2px 8px rgba(15,23,42,0.06);">
        <tr>
          <td style="background: #0c8ee9; background-image: linear-gradient(135deg, #0c8ee9, #4f46e5); padding: 26px 32px;">
            <p style="${font} margin: 0; color: #ffffff; font-size: 22px; font-weight: 800;">ScholarLogic</p>
            <p style="${font} margin: 6px 0 0; color: #ffffff; font-size: 17px; font-weight: bold;">Welcome to ${esc(o.courseName)} 🎓</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 28px 32px 6px;">
            <p style="${font} margin: 0 0 14px; color: #0f172a; font-size: 15px;">Dear <strong>${esc(o.name)}</strong>,</p>
            <p style="${font} margin: 0 0 18px; color: #334155; font-size: 15px; line-height: 1.6;">Your registration at ScholarLogic is verified. Here is what you will learn in <strong>${esc(o.courseName)}</strong>, step by step.</p>
            ${
              o.idCardFormUrl
                ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #fef2f2; border: 2px solid #ef4444; border-radius: 12px; margin: 0 0 20px;">
              <tr><td style="${font} padding: 16px 18px;">
                <p style="margin: 0 0 6px; color: #b91c1c; font-size: 16px; font-weight: 800;">&#9888; Next step (mandatory): fill the ID card form</p>
                <p style="margin: 0 0 10px; color: #7f1d1d; font-size: 14px; line-height: 1.6;">Your <strong>ScholarLogic ID card is mandatory</strong>. Without it you <strong>cannot log in to the LMS</strong> and your <strong>attendance is not recorded</strong> on the biometric machine. Fill the ID card form today with your photo.</p>
                <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius: 10px; background: #dc2626;"><a href="${esc(o.idCardFormUrl)}" style="${font} display: inline-block; padding: 12px 24px; color: #ffffff; font-size: 14px; font-weight: bold; text-decoration: none;">Fill the ID card form &rarr;</a></td></tr></table>
                <p style="margin: 10px 0 0; color: #7f1d1d; font-size: 13px; line-height: 1.5;">After we verify it, you get your ID card number (SCLR…). Once the card is added to the biometric machine, we email your <strong>Login ID and password</strong>.</p>
              </td></tr>
            </table>`
                : ''
            }
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 18px;">
              <tr>
                <td style="${font} background: #eff6ff; border-radius: 10px; padding: 12px; text-align: center; width: 33%;"><span style="display: block; color: #1d4ed8; font-size: 20px; font-weight: 800;">${o.subjects.length}</span><span style="color: #475569; font-size: 12px;">subjects</span></td>
                <td style="width: 8px;"></td>
                <td style="${font} background: #ecfdf5; border-radius: 10px; padding: 12px; text-align: center; width: 33%;"><span style="display: block; color: #047857; font-size: 20px; font-weight: 800;">${o.months ? `${o.months} months` : `${Math.round(totalDays / 30)} months`}</span><span style="color: #475569; font-size: 12px;">course length</span></td>
                <td style="width: 8px;"></td>
                <td style="${font} background: #f5f3ff; border-radius: 10px; padding: 12px; text-align: center; width: 33%;"><span style="display: block; color: #6d28d9; font-size: 20px; font-weight: 800;">${esc(o.mode)}</span><span style="color: #475569; font-size: 12px;">class mode</span></td>
              </tr>
            </table>
            <p style="${font} margin: 0 0 6px; color: #0f172a; font-size: 16px; font-weight: 800;">Your course, subject by subject</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${steps}
            </table>
            <p style="${font} margin: 18px 0 6px; color: #0f172a; font-size: 15px; font-weight: bold;">What happens next</p>
            <ol style="${font} margin: 0 0 6px; padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.7;">
              ${o.idCardFormUrl ? '<li><strong style="color: #b91c1c;">Fill the ID card form (mandatory).</strong> You then get your ID card number, and your login after the card is on the biometric machine.</li>' : ''}
              <li>We put you in a batch for your first subject. You get an email with the batch, trainer and timing.</li>
              <li>Log in to the portal to see your course journey, attendance, classes and tests.</li>
              ${o.idCardFormUrl ? '' : `<li>Your Student ID is <strong style="color: #0f172a;">${esc(o.studentId)}</strong>.</li>`}
            </ol>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 20px 0 8px;">
              <tr><td style="border-radius: 10px; background: ${o.idCardFormUrl ? '#dc2626' : '#0c8ee9'};"><a href="${esc(o.idCardFormUrl || portal)}" style="${font} display: inline-block; padding: 12px 26px; color: #ffffff; font-size: 14px; font-weight: bold; text-decoration: none;">${o.idCardFormUrl ? 'Fill the ID card form &rarr;' : 'Open my portal &rarr;'}</a></td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 18px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
            <p style="${font} margin: 0 0 4px; color: #475569; font-size: 13px;">Questions? Reply to this email or call <a href="tel:+919008625716" style="color: #0c8ee9; text-decoration: none;">+91 90086 25716</a>.</p>
            <p style="${font} margin: 0; color: #94a3b8; font-size: 12px;">Regards, ScholarLogic Team</p>
          </td>
        </tr>
      </table>
      <p style="${font} margin: 14px 0 0; color: #94a3b8; font-size: 11px;">You received this because you registered at ScholarLogic.</p>
    </td></tr>
  </table>
</body></html>`;
    const text = [
      `Dear ${o.name},`,
      '',
      `Your registration at ScholarLogic is verified. Welcome to ${o.courseName}!`,
      ...(o.idCardFormUrl
        ? [
            '',
            'NEXT STEP (MANDATORY): fill the ID card form',
            `${o.idCardFormUrl}`,
            'Your ScholarLogic ID card is mandatory. Without it you cannot log in to the LMS and your attendance is not recorded.',
            'After we verify it you get your ID card number; once the card is on the biometric machine we email your Login ID and password.',
          ]
        : []),
      `${o.subjects.length} subjects • ${o.months || Math.round(totalDays / 30)} months • ${o.mode}`,
      '',
      'Your course, subject by subject:',
      ...o.subjects.map((s, i) => `${i + 1}. ${s.name} (about ${s.days} days)${s.topics.length ? `: ${s.topics.join(', ')}` : ''}`),
      '',
      'What happens next: we put you in a batch for your first subject and email you the details.',
      `Your Student ID: ${o.studentId}`,
      `Portal: ${portal}`,
      '',
      'Questions? Reply to this email or call +91 90086 25716.',
      '',
      'Regards,',
      'ScholarLogic Team',
    ].join('\n');
    const info = await this.transporter.sendMail({
      from: process.env.EMAIL_FROM || 'ScholarLogic <noreply@scholarlogiclms.in>',
      replyTo: process.env.EMAIL_REPLY_TO || 'tech@scholarlogic.net',
      to: o.to,
      subject: o.idCardFormUrl
        ? `${o.name.split(' ')[0] || 'Student'}, registration verified: fill your ID card form (mandatory)`
        : `Welcome to ${o.courseName}, ${o.name.split(' ')[0] || 'Student'}: your course overview`,
      html,
      text,
    });
    return String(info.messageId || '');
  }

  // A trainer was given a batch: which batch, when, and the students in it (names only).
  async sendTrainerBatchEmail(o: {
    to: string;
    name: string;
    batchCode: string;
    subject: string;
    timing: string;
    mode: string;
    startDate: string;
    endDate: string;
    students: string[];
    siteUrl: string;
  }): Promise<string> {
    if (!this.transporter) await this.initTransporter();
    if (!this.transporter || this.providerType === 'ethereal') throw new Error('Email is not set up on the server (RESEND_API_KEY)');
    const esc = (v: string) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
    const portal = `${o.siteUrl.replace(/\/+$/, '')}/login`;
    const font = "font-family: 'Segoe UI', Arial, Helvetica, sans-serif;";
    const row = (label: string, value: string, last = false) => `
              <tr>
                <td style="${font} padding: 9px 0; ${last ? '' : 'border-bottom: 1px solid #e2e8f0;'} color: #64748b; font-size: 13px; width: 120px;">${esc(label)}</td>
                <td style="${font} padding: 9px 0; ${last ? '' : 'border-bottom: 1px solid #e2e8f0;'} color: #0f172a; font-size: 15px; font-weight: bold;">${esc(value)}</td>
              </tr>`;
    const names = o.students.length
      ? `<ol style="${font} margin: 0; padding-left: 22px; color: #0f172a; font-size: 14px; line-height: 1.8;">${o.students.map((n) => `<li>${esc(n)}</li>`).join('')}</ol>`
      : `<p style="${font} margin: 0; color: #64748b; font-size: 14px;">No students added yet. They will appear on your batch page as the admin adds them.</p>`;
    const html = `<!doctype html>
<html><body style="margin: 0; padding: 0; background: #f1f5f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f1f5f9; padding: 24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 2px 8px rgba(15,23,42,0.06);">
        <tr>
          <td style="background: #0c8ee9; background-image: linear-gradient(135deg, #0c8ee9, #4f46e5); padding: 24px 32px;">
            <p style="${font} margin: 0; color: #ffffff; font-size: 22px; font-weight: 800;">ScholarLogic</p>
            <p style="${font} margin: 6px 0 0; color: #ffffff; font-size: 17px; font-weight: bold;">New batch assigned: ${esc(o.batchCode)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 28px 32px 6px;">
            <p style="${font} margin: 0 0 14px; color: #0f172a; font-size: 15px;">Dear <strong>${esc(o.name)}</strong>,</p>
            <p style="${font} margin: 0 0 18px; color: #334155; font-size: 15px; line-height: 1.6;">You have been assigned the batch below. Please check the timing and the student list.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 4px 20px;">
              ${row('Batch', o.batchCode)}
              ${row('Subject', o.subject)}
              ${row('Timing', o.timing)}
              ${row('Mode', o.mode)}
              ${row('Starts on', o.startDate)}
              ${row('Expected end', o.endDate)}
              ${row('Students', String(o.students.length), true)}
            </table>
            <p style="${font} margin: 22px 0 8px; color: #0f172a; font-size: 16px; font-weight: 800;">Students (${o.students.length})</p>
            ${names}
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0 8px;">
              <tr><td style="border-radius: 10px; background: #0c8ee9;"><a href="${esc(portal)}" style="${font} display: inline-block; padding: 12px 24px; color: #ffffff; font-size: 14px; font-weight: bold; text-decoration: none;">Open my batches &rarr;</a></td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 18px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
            <p style="${font} margin: 0 0 4px; color: #475569; font-size: 13px;">Questions? Reply to this email or call <a href="tel:+919008625716" style="color: #0c8ee9; text-decoration: none;">+91 90086 25716</a>.</p>
            <p style="${font} margin: 0; color: #94a3b8; font-size: 12px;">Regards, ScholarLogic Team</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
    const text = [
      `Dear ${o.name},`,
      '',
      `You have been assigned batch ${o.batchCode}.`,
      '',
      `Subject: ${o.subject}`,
      `Timing: ${o.timing}`,
      `Mode: ${o.mode}`,
      `Starts on: ${o.startDate}`,
      `Expected end: ${o.endDate}`,
      `Students: ${o.students.length}`,
      '',
      ...o.students.map((n, i) => `${i + 1}. ${n}`),
      '',
      `Open your batches: ${portal}`,
      '',
      'Regards,',
      'ScholarLogic Team',
    ].join('\n');
    const info = await this.transporter.sendMail({
      from: process.env.EMAIL_FROM || 'ScholarLogic <noreply@scholarlogiclms.in>',
      replyTo: process.env.EMAIL_REPLY_TO || 'tech@scholarlogic.net',
      to: o.to,
      subject: `New batch assigned: ${o.batchCode} (${o.subject}, ${o.timing}) • ${o.students.length} student${o.students.length === 1 ? '' : 's'}`,
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
