import { BiometricDevice } from '../models/BiometricPunch';
import { BiometricSyncLog, BiometricLogKind } from '../models/BiometricIntegration';

/** Appends to the sync log; logging must never break the operation being logged. */
export const logSync = async (
  kind: BiometricLogKind,
  level: 'INFO' | 'WARN' | 'ERROR',
  message: string,
  extra: { deviceSerial?: string; meta?: Record<string, unknown> } = {}
) => {
  try {
    await BiometricSyncLog.create({ kind, level, message, deviceSerial: extra.deviceSerial || '', meta: extra.meta });
    if (level === 'ERROR' && extra.deviceSerial) {
      await BiometricDevice.updateOne({ serialNumber: extra.deviceSerial }, { $set: { lastErrorAt: new Date(), lastError: message } });
    }
  } catch (err) {
    console.error('[Biometric] Could not write sync log', err);
  }
};

/** Card numbers are stored as plain digits without leading zeros ("0001234567" → "1234567"); '' = no card. */
export const normalizeCard = (raw: unknown): string => {
  const digits = String(raw ?? '').trim();
  if (!/^\d+$/.test(digits)) return digits;
  return digits.replace(/^0+/, '');
};

/**
 * Card numbers a machine-reported Card value can stand for. Firmware reports either the decimal
 * number or the raw bytes in brackets ("[09E4812202]", least significant byte first).
 */
export const deviceCardCandidates = (raw: string): string[] => {
  const value = String(raw || '').trim();
  if (!value) return [];
  if (/^\d+$/.test(value)) {
    const n = normalizeCard(value);
    return n ? [n] : [];
  }
  const hex = /^\[?([0-9A-Fa-f]{2,})\]?$/.exec(value)?.[1];
  if (!hex || hex.length % 2) return [];
  const bytes = hex.match(/../g)!.map((b) => parseInt(b, 16));
  const out = new Set<string>();
  const little = bytes.slice(0, 4).reduceRight((acc, b) => acc * 256n + BigInt(b), 0n);
  const big = bytes.reduce((acc, b) => acc * 256n + BigInt(b), 0n);
  [little, big].forEach((n) => n > 0n && out.add(n.toString()));
  return [...out];
};
