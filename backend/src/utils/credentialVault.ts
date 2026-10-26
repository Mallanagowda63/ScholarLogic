import crypto from 'crypto';
import { env } from '../config/env';

// Student login passwords that admins hand out are kept encrypted (AES-256-GCM) so the admin panel can
// show them again. The login itself still checks the bcrypt hash on the User.
const key = crypto.createHash('sha256').update(process.env.CREDENTIAL_KEY || env.JWT_SECRET).digest();

export function sealPassword(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

/** null when nothing is stored or it was sealed with another key */
export function openPassword(sealed?: string | null): string | null {
  if (!sealed) return null;
  try {
    const [iv, tag, data] = sealed.split('.').map((s) => Buffer.from(s, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
