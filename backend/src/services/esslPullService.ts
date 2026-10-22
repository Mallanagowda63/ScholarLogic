import { env } from '../config/env';
import { BiometricDevice, BiometricPunch } from '../models/BiometricPunch';
import { BiometricDeviceUser } from '../models/BiometricIntegration';
import { ingestAttlog } from './biometricService';
import { logSync } from './biometricShared';
import { readDevice } from './zkDeviceClient';

/**
 * Reads users and punches straight from the eSSL machine over its PC-connection port (read-only)
 * and stores them like an ADMS upload: punches link to a student only through an exact E Number
 * (the code admins give in eSSL Web, e.g. SCLR245); everything else waits in the review queue.
 */

export interface PullResult {
  at: Date;
  ok: boolean;
  trigger: 'manual' | 'auto';
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
    const serial = snap.serialNumber || 'UNKNOWN';
    if (env.BIOMETRIC_DEVICE_SERIALS.length && !env.BIOMETRIC_DEVICE_SERIALS.includes(serial)) {
      throw new Error(`The machine at ${env.ESSL_DEVICE_HOST} reports serial ${serial}, which is not in BIOMETRIC_DEVICE_SERIALS`);
    }

    // The machine's user list (code + name) feeds the review screen's name suggestions
    const usersSignature = JSON.stringify(snap.users.map((u) => [u.userId, u.name, u.card, u.privilege]));
    if (snap.users.length && usersSignature !== lastUsersSignature) {
      await BiometricDeviceUser.bulkWrite(
        snap.users.map((u) => ({
          updateOne: {
            filter: { deviceSerial: serial, pin: u.userId },
            update: { $set: { name: u.name, card: u.card, privilege: String(u.privilege), rawLine: 'TCP pull', reportedAt: at } },
            upsert: true,
          },
        })),
        { ordered: false }
      );
      lastUsersSignature = usersSignature;
    }

    // The machine always hands over its whole log. Only punches from 2 days before the newest one already
    // stored are sent on (the rest are stored already), so a routine read writes a handful of rows, not thousands
    const newest: any = await BiometricPunch.findOne({ deviceSerial: serial }).sort({ punchTime: -1 }).select('localDate').lean();
    let fresh = snap.punches;
    if (newest?.localDate) {
      const cutoff = new Date(Date.parse(`${newest.localDate}T00:00:00Z`) - 2 * 86400000).toISOString().slice(0, 10);
      fresh = snap.punches.filter((p) => p.localTime.slice(0, 10) >= cutoff);
    }
    const body = fresh.map((p) => `${p.userId}\t${p.localTime}\t${p.state}\t${p.verify}`).join('\n');
    const counts = await ingestAttlog(serial, body);
    await BiometricDevice.updateOne(
      { serialNumber: serial },
      { $set: { lastSeenAt: at, lastIp: `${env.ESSL_DEVICE_HOST}:${env.ESSL_DEVICE_PORT} (read)` } },
      { upsert: true }
    );

    const message = `Read ${snap.users.length} users and ${snap.punches.length} punches; ${counts.inserted} new${
      counts.unknown ? `, ${counts.unknown} new from codes not linked to a student yet` : ''
    }`;
    if (counts.inserted) await logSync('DEVICE', 'INFO', `Machine read (${trigger}): ${message}`, { deviceSerial: serial, meta: { ...counts } });
    return {
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
