import crypto from 'crypto';
import { env } from '../config/env';
import { BiometricDevice, BiometricPunch } from '../models/BiometricPunch';
import { BiometricDeviceUser } from '../models/BiometricIntegration';
import { Student } from '../models/Student';
import { ingestAttlog } from './biometricService';
import { logSync, normalizeCard } from './biometricShared';
import { createStudentAccount } from './studentAccountService';
import { readDevice, DeviceSnapshot } from './zkDeviceClient';

/**
 * Reads users and punches straight from the eSSL machine over its PC-connection port (read-only)
 * and stores them like an ADMS upload: punches link to a student only through an exact E Number
 * (the code admins give in eSSL Web, e.g. SCLR245); everything else waits in the review queue.
 */

export interface PullResult {
  at: Date;
  ok: boolean;
  trigger: 'manual' | 'auto' | 'agent';
  message: string;
  serialNumber?: string;
  users?: number;
  punchesRead?: number;
  newPunches?: number;
  unlinkedPunches?: number;
}

let lastPull: PullResult | null = null;
// Fingerprint of the machine's user list from the last read; the list is only re-saved when it changes
let lastUsersSignature = '';
let running: Promise<PullResult> | null = null;

export const isMachinePullConfigured = () => !!env.ESSL_DEVICE_HOST;
export const getLastPull = () => lastPull;

/**
 * Stores one reading of the machine, whoever made it: this server (direct read) or the campus helper
 * (agent push). Same rules either way: known serial only, users re-saved when changed, punches from
 * 2 days before the newest stored one, each punch once.
 */
export async function storeSnapshot(
  snap: Pick<DeviceSnapshot, 'serialNumber' | 'users' | 'punches'>,
  trigger: PullResult['trigger'],
  source: string
): Promise<PullResult> {
  const at = new Date();
  const serial = snap.serialNumber || 'UNKNOWN';
  if (env.BIOMETRIC_DEVICE_SERIALS.length && !env.BIOMETRIC_DEVICE_SERIALS.includes(serial)) {
    throw new Error(`The machine reports serial ${serial}, which is not in BIOMETRIC_DEVICE_SERIALS`);
  }

  // The machine's user list (code + name) feeds the review screen's name suggestions
  const usersSignature = JSON.stringify(snap.users.map((u) => [u.userId, u.name, u.card, u.privilege]));
  if (snap.users.length && usersSignature !== lastUsersSignature) {
    const knownPins = new Set<string>(await BiometricDeviceUser.distinct('pin', { deviceSerial: serial }));
    await BiometricDeviceUser.bulkWrite(
      snap.users.map((u) => ({
        updateOne: {
          filter: { deviceSerial: serial, pin: u.userId },
          update: { $set: { name: u.name, card: u.card, privilege: String(u.privilege), rawLine: trigger === 'agent' ? 'Campus helper' : 'TCP pull', reportedAt: at } },
          upsert: true,
        },
      })),
      { ordered: false }
    );
    lastUsersSignature = usersSignature;
    // The very first read only records what is already there; after that, a code that appears is a new card
    if (knownPins.size && env.ESSL_AUTO_CREATE_STUDENTS) await createStudentsForNewCodes(snap.users.filter((u) => !knownPins.has(u.userId)));
  }

  // The machine always hands over its whole log. Only punches from 2 days before the newest one already
  // stored are sent on (the rest are stored already), so a routine read writes a handful of rows, not thousands
  const cutoff = await punchCutoff(serial);
  const fresh = cutoff ? snap.punches.filter((p) => p.localTime.slice(0, 10) >= cutoff) : snap.punches;
  const body = fresh.map((p) => [p.userId, p.localTime, p.state, p.verify].join('\t')).join('\n');
  const counts = await ingestAttlog(serial, body);
  await BiometricDevice.updateOne({ serialNumber: serial }, { $set: { lastSeenAt: at, lastIp: source } }, { upsert: true });

  const message = `Read ${snap.users.length} users and ${snap.punches.length} punches; ${counts.inserted} new${
    counts.unknown ? `, ${counts.unknown} new from codes not linked to a student yet` : ''
  }`;
  if (counts.inserted) await logSync('DEVICE', 'INFO', `Machine read (${trigger}): ${message}`, { deviceSerial: serial, meta: { ...counts } });
  const result: PullResult = {
    at,
    ok: true,
    trigger,
    message,
    serialNumber: serial,
    users: snap.users.length,
    punchesRead: snap.punches.length,
    newPunches: counts.inserted,
    unlinkedPunches: counts.unknown,
  };
  lastPull = result;
  return result;
}

// Same shape as the passwords handed out on 2026-10-14: no look-alike characters, ends with @ and a digit
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const generatePassword = () => `${Array.from({ length: 8 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('')}@${crypto.randomInt(10)}`;
const nameKey = (s: string) => (s || '').toLowerCase().replace(/[^a-z]/g, '');

/**
 * A code that newly appears on the machine (a card or fingerprint just issued in eSSL Web) becomes a
 * student: Student ID = login ID = the code, with a generated password that Admin → Students shows.
 * Skipped, and left to the review queue: machine admins, codes already in use, and names that match a
 * student who has no code yet (most likely the same person, already registered from the Google Form).
 */
async function createStudentsForNewCodes(users: DeviceSnapshot['users']) {
  for (const u of users) {
    const code = u.userId.trim().toUpperCase();
    if (!code || Number(u.privilege) > 0) continue;
    if (await Student.exists({ $or: [{ biometricId: code }, { studentId: code }] })) continue;
    const fullName = (u.name || '').trim() || code;
    const key = nameKey(fullName);
    const unlinked: any[] = key
      ? await Student.find({ $or: [{ biometricId: { $exists: false } }, { biometricId: '' }] }).select('userId').populate('userId', 'fullName').lean()
      : [];
    if (unlinked.some((s) => nameKey(s.userId?.fullName) === key)) {
      await logSync('DEVICE', 'WARN', `New machine code ${code} (${fullName}) matches a student without a code; confirm the link in the review queue`);
      continue;
    }
    try {
      const { student } = await createStudentAccount({ fullName, password: generatePassword(), customStudentId: code, joinedDetails: `Added from the eSSL machine (code ${code})` });
      const card = normalizeCard(u.card);
      const cardFree = card && /^[1-9]\d{0,19}$/.test(card) && !(await Student.exists({ cardNumber: card }));
      await Student.updateOne({ _id: student._id }, { $set: { biometricId: code, ...(cardFree ? { cardNumber: card } : {}) } });
      await logSync('DEVICE', 'INFO', `Created student ${code} (${fullName}) from a new code on the machine`);
    } catch (err: any) {
      await logSync('DEVICE', 'ERROR', `Could not create a student for new machine code ${code}: ${err.message}`);
    }
  }
}

/** First date (YYYY-MM-DD) worth sending: 2 days before the newest punch already stored; '' = send everything */
export async function punchCutoff(serial: string) {
  const newest: any = await BiometricPunch.findOne({ deviceSerial: serial }).sort({ punchTime: -1 }).select('localDate').lean();
  return newest?.localDate ? new Date(Date.parse(`${newest.localDate}T00:00:00Z`) - 2 * 86400000).toISOString().slice(0, 10) : '';
}

export const recordAgentFailure = (message: string) => {
  lastPull = { at: new Date(), ok: false, trigger: 'agent', message };
};

async function doPull(trigger: 'manual' | 'auto'): Promise<PullResult> {
  const at = new Date();
  if (!isMachinePullConfigured()) {
    return { at, ok: false, trigger, message: 'Machine address not set (ESSL_DEVICE_HOST in backend .env)' };
  }
  try {
    // Hard limit for the whole read, so one stuck read can never block every later one
    const readOnce = () =>
      Promise.race([
        readDevice({ host: env.ESSL_DEVICE_HOST, port: env.ESSL_DEVICE_PORT, commKey: env.ESSL_COMM_KEY }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Reading the machine took longer than 2 minutes')), 120000)),
      ]);
    // The machine sometimes drops a connection (e.g. while eSSL Web or another PC is talking to it): retry briefly
    let snap: Awaited<ReturnType<typeof readDevice>> | undefined;
    for (let attempt = 1; !snap; attempt += 1) {
      try {
        snap = await readOnce();
      } catch (err) {
        if (attempt >= 3) throw err;
        await new Promise((r) => setTimeout(r, attempt * 5000));
      }
    }
    return await storeSnapshot(snap, trigger, `${env.ESSL_DEVICE_HOST}:${env.ESSL_DEVICE_PORT} (read)`);
  } catch (err: any) {
    const message = String(err?.message || err);
    await logSync('DEVICE', 'ERROR', `Machine read failed (${trigger}): ${message}`);
    return { at, ok: false, trigger, message };
  }
}

/** One read at a time; concurrent callers share it */
export async function pullFromMachine(trigger: 'manual' | 'auto' = 'manual') {
  if (!running) running = doPull(trigger).finally(() => (running = null));
  lastPull = await running;
  return lastPull;
}

export function startMachinePull() {
  const minutes = env.ESSL_PULL_INTERVAL_MINUTES;
  if (!isMachinePullConfigured() || !minutes || minutes <= 0) return null;
  const run = () =>
    pullFromMachine('auto')
      .then((r) => {
        if (!r.ok) console.warn(`⚠️ eSSL machine read failed: ${r.message}`);
        else if (r.newPunches) console.log(`🖐️ eSSL machine: ${r.message}`);
      })
      .catch(() => undefined);
  setTimeout(run, 15000);
  const timer = setInterval(run, minutes * 60000);
  console.log(`🖐️ eSSL machine read every ${minutes} min from ${env.ESSL_DEVICE_HOST}:${env.ESSL_DEVICE_PORT}`);
  return timer;
}
