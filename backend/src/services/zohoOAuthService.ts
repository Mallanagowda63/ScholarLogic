import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User } from '../models/User';
import { AppError } from '../middleware/errorHandler';
import { openPassword, sealPassword } from '../utils/credentialVault';

/**
 * Zoho Meeting for trainers: each trainer connects their own Zoho account once (OAuth, "Connect Zoho"),
 * then ScholarLogic creates class meetings in that account. Only the refresh token is stored, encrypted.
 * Needs ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET from api-console.zoho.in (Server-based application) with the
 * redirect URI <BACKEND_URL>/api/integrations/zoho/callback.
 */

const SCOPES = ['ZohoMeeting.meeting.ALL', 'ZohoMeeting.manageOrg.READ', 'ZohoMeeting.recording.READ'].join(',');
const STATE_TYPE = 'zoho-connect';

export const isZohoConfigured = () => !!(env.ZOHO_CLIENT_ID && env.ZOHO_CLIENT_SECRET);
export const zohoRedirectUri = () => `${env.BACKEND_URL.replace(/\/+$/, '')}/api/integrations/zoho/callback`;
const frontend = () => env.FRONTEND_URL.replace(/\/+$/, '');

const requireConfig = () => {
  if (!isZohoConfigured()) throw new AppError('Zoho is not set up yet. Ask the admin to add the Zoho Client ID and Secret.', 503, 'ZOHO_NOT_CONFIGURED');
};

/** Zoho login page for this trainer; the signed state brings them back to their own account */
export function zohoConnectUrl(userId: string, returnTo = '/trainer/batches'): string {
  requireConfig();
  const state = jwt.sign({ typ: STATE_TYPE, uid: userId, ret: returnTo.startsWith('/') ? returnTo : '/trainer/batches' }, env.JWT_SECRET, { expiresIn: '15m' });
  const q = new URLSearchParams({
    scope: SCOPES,
    client_id: env.ZOHO_CLIENT_ID,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    redirect_uri: zohoRedirectUri(),
    state,
  });
  return `${env.ZOHO_ACCOUNTS_URL}/oauth/v2/auth?${q.toString()}`;
}

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch(`${env.ZOHO_ACCOUNTS_URL}/oauth/v2/token?${new URLSearchParams(params).toString()}`, { method: 'POST', signal: AbortSignal.timeout(20000) });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok || body.error || !body.access_token) throw new AppError(`Zoho refused the sign-in (${body.error || res.status})`, 502, 'ZOHO_TOKEN_FAILED');
  return body as { access_token: string; refresh_token?: string; api_domain?: string };
}

async function zohoApi(accessToken: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${env.ZOHO_MEETING_URL}${path}`, {
    ...init,
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json;charset=UTF-8', ...(init.headers || {}) },
    signal: AbortSignal.timeout(20000),
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const msg = body?.error?.message || body?.message || `HTTP ${res.status}`;
    throw new AppError(`Zoho Meeting: ${msg}`, 502, 'ZOHO_API_FAILED');
  }
  return body;
}

/** Back from the Zoho login page: keep the refresh token and the trainer's Zoho org/user ids. Returns where to send the browser. */
export async function finishZohoConnect(code: string, state: string): Promise<string> {
  let payload: any;
  try {
    payload = jwt.verify(state, env.JWT_SECRET);
  } catch {
    return `${frontend()}/trainer/batches?zoho=expired`;
  }
  if (payload?.typ !== STATE_TYPE || !payload.uid) return `${frontend()}/trainer/batches?zoho=invalid`;
  const back = `${frontend()}${payload.ret || '/trainer/batches'}`;
  const sep = back.includes('?') ? '&' : '?';
  try {
    requireConfig();
    const tokens = await tokenRequest({ grant_type: 'authorization_code', client_id: env.ZOHO_CLIENT_ID, client_secret: env.ZOHO_CLIENT_SECRET, redirect_uri: zohoRedirectUri(), code });
    if (!tokens.refresh_token) throw new AppError('Zoho did not give long-term access. Please try Connect Zoho again.', 502, 'ZOHO_NO_REFRESH');
    const me: any = await zohoApi(tokens.access_token, '/api/v2/user.json');
    const d = me?.userDetails || {};
    await User.updateOne(
      { _id: payload.uid, role: 'TRAINER' },
      { $set: { zoho: { refreshToken: sealPassword(tokens.refresh_token), email: d.primaryEmail || d.emailId || '', zsoid: String(d.zsoid || ''), zuid: String(d.zuid || ''), connectedAt: new Date() } } }
    );
    return `${back}${sep}zoho=connected`;
  } catch (err: any) {
    return `${back}${sep}zoho=error&reason=${encodeURIComponent(String(err?.message || err).slice(0, 120))}`;
  }
}

export async function zohoStatus(userId: string) {
  const u: any = await User.findById(userId).select('zoho').lean();
  return { configured: isZohoConfigured(), connected: !!u?.zoho?.connectedAt, email: u?.zoho?.email || '', connectedAt: u?.zoho?.connectedAt || null };
}

export async function disconnectZoho(userId: string) {
  await User.updateOne({ _id: userId }, { $unset: { zoho: '' } });
}

async function accessTokenFor(userId: string) {
  requireConfig();
  const u: any = await User.findById(userId).select('+zoho.refreshToken zoho').lean();
  const refresh = openPassword(u?.zoho?.refreshToken);
  if (!refresh || !u?.zoho?.zsoid) throw new AppError('Connect your Zoho account first (Connect Zoho button).', 400, 'ZOHO_NOT_CONNECTED');
  const tokens = await tokenRequest({ grant_type: 'refresh_token', client_id: env.ZOHO_CLIENT_ID, client_secret: env.ZOHO_CLIENT_SECRET, refresh_token: refresh });
  return { token: tokens.access_token, zsoid: u.zoho.zsoid as string, zuid: u.zoho.zuid as string };
}

// Zoho wants the start time like "Nov 13, 2026 10:00 AM" in the given time zone
const zohoTime = (d: Date) => {
  const ist = new Date(d.getTime() + 330 * 60000);
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][ist.getUTCMonth()];
  const h = ist.getUTCHours();
  const hh = String(h % 12 || 12).padStart(2, '0');
  return `${mon} ${String(ist.getUTCDate()).padStart(2, '0')}, ${ist.getUTCFullYear()} ${hh}:${String(ist.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

/** Creates a meeting in the trainer's own Zoho account; returns the student join link and the trainer's start link */
export async function createZohoMeeting(userId: string, opts: { topic: string; agenda?: string; start: Date; durationMinutes: number }) {
  const { token, zsoid, zuid } = await accessTokenFor(userId);
  const body = {
    session: {
      topic: opts.topic.slice(0, 100),
      agenda: (opts.agenda || '').slice(0, 500),
      presenter: zuid,
      startTime: zohoTime(opts.start),
      duration: Math.max(15, Math.min(600, opts.durationMinutes)) * 60000,
      timezone: 'Asia/Calcutta',
    },
  };
  const res: any = await zohoApi(token, `/api/v2/${encodeURIComponent(zsoid)}/sessions.json`, { method: 'POST', body: JSON.stringify(body) });
  const s = res?.session || {};
  if (!s.joinLink) throw new AppError('Zoho created no join link', 502, 'ZOHO_API_FAILED');
  return { joinLink: String(s.joinLink), startLink: String(s.startLink || ''), meetingKey: String(s.meetingKey || '') };
}
