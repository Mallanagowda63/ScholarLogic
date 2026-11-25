import express, { Router, Request, Response } from 'express';
import { env } from '../config/env';
import { BiometricDevice } from '../models/BiometricPunch';
import { ingestAttlog } from '../services/biometricService';
import { collectCommands, recordCommandResults, recordDeviceUsers } from '../services/esslService';
import { logSync } from '../services/biometricShared';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * eSSL / ZKTeco ADMS ("iclock") push protocol. On the machine set
 *   Comm → Cloud Server (ADMS): Server address = this backend's host, Server port = its port.
 * The device then calls:
 *   GET  /iclock/cdata?SN=..&options=all        handshake, we reply with push options
 *   POST /iclock/cdata?SN=..&table=ATTLOG       punches, one per line
 *   POST /iclock/cdata?SN=..&table=OPERLOG      user changes ("USER PIN=.." lines) and operation log
 *   GET  /iclock/getrequest?SN=..               polls for commands; queued student pushes go out here
 *   POST /iclock/devicecmd?SN=..                the machine's result for each command
 * Firmware variants append ".aspx" to these paths. Replies are plain text.
 */
const router = Router();

// Devices send text/plain or no content type at all; read every body as raw text
router.use(express.text({ type: () => true, limit: '10mb' }));

const reply = (res: Response, body: string, status = 200) => res.status(status).type('text/plain').send(body);

const serialOf = (req: Request) => String(req.query.SN || req.query.sn || '').trim();

const isAllowed = (sn: string) => !!sn && (env.BIOMETRIC_DEVICE_SERIALS.length === 0 || env.BIOMETRIC_DEVICE_SERIALS.includes(sn));

const touchDevice = (req: Request, sn: string, extra: Record<string, unknown> = {}) =>
  BiometricDevice.updateOne(
    { serialNumber: sn },
    { $set: { lastSeenAt: new Date(), lastIp: req.ip || '', ...extra } },
    { upsert: true }
  );

router.use((req, res, next) => {
  const sn = serialOf(req);
  if (!isAllowed(sn)) {
    console.warn(`[ADMS] Rejected request from unknown device SN="${sn}" ip=${req.ip} ${req.method} ${req.path}`);
    return reply(res, 'Unknown device', 403);
  }
  next();
});

router.get(/^\/cdata(\.aspx)?$/, asyncHandler(async (req: Request, res: Response) => {
  const sn = serialOf(req);
  const pushVersion = String(req.query.pushver || '').slice(0, 40);
  const device = await BiometricDevice.findOneAndUpdate(
    { serialNumber: sn },
    { $set: { lastSeenAt: new Date(), lastIp: req.ip || '', ...(pushVersion ? { pushVersion } : {}) } },
    { upsert: true, new: true }
  );
  reply(
    res,
    [
      `GET OPTION FROM: ${sn}`,
      `ATTLOGStamp=${device.attlogStamp || 'None'}`,
      'OPERLOGStamp=9999',
      'ATTPHOTOStamp=None',
      'ErrorDelay=30',
      'Delay=10',
      'TransTimes=00:00;14:05',
      'TransInterval=1',
      // Punches, plus user changes so ScholarLogic can see which card the machine holds under each ID
      'TransFlag=TransData AttLog\tOpLog\tEnrollUser\tChgUser',
      // Hours when whole, otherwise minutes (IST → 330), per the ADMS spec
      `TimeZone=${env.BIOMETRIC_TZ_OFFSET_MINUTES % 60 === 0 ? env.BIOMETRIC_TZ_OFFSET_MINUTES / 60 : env.BIOMETRIC_TZ_OFFSET_MINUTES}`,
      'Realtime=1',
      'Encrypt=None',
    ].join('\n')
  );
}));

router.post(/^\/cdata(\.aspx)?$/, asyncHandler(async (req: Request, res: Response) => {
  const sn = serialOf(req);
  const table = String(req.query.table || '').toUpperCase();
  const body = typeof req.body === 'string' ? req.body : '';

  if (table === 'ATTLOG') {
    try {
      const { received, inserted } = await ingestAttlog(sn, body);
      await touchDevice(req, sn, req.query.Stamp ? { attlogStamp: String(req.query.Stamp) } : {});
      if (received) console.log(`[ADMS] ${sn}: ${received} punch(es) received, ${inserted} new`);
      return reply(res, `OK: ${received}`);
    } catch (err: any) {
      console.error('[ADMS] Failed to store ATTLOG', err);
      await logSync('ATTLOG', 'ERROR', `Attendance upload could not be stored: ${err?.message || err}. The machine keeps the records and sends them again.`, {
        deviceSerial: sn,
      });
      // Not OK → the device keeps the records and retries after ErrorDelay
      return reply(res, 'ERROR', 500);
    }
  }

  // User records (OPERLOG "USER ..." lines, or a USERINFO upload answering a query). Other tables are acknowledged only
  if (table === 'OPERLOG' || table === 'USERINFO') {
    try {
      await recordDeviceUsers(sn, body, table === 'OPERLOG');
    } catch (err: any) {
      console.error('[ADMS] Failed to store user records', err);
      await logSync('USERS', 'ERROR', `User records from the machine could not be stored: ${err?.message || err}`, { deviceSerial: sn });
    }
  }
  await touchDevice(req, sn);
  const lines = body.split(/\r?\n/).filter((l) => l.trim()).length;
  reply(res, `OK: ${lines}`);
}));

// The machine polls here; queued commands (students to write) are handed over in the reply
router.get(/^\/getrequest(\.aspx)?$/, asyncHandler(async (req: Request, res: Response) => {
  const sn = serialOf(req);
  const info = String(req.query.INFO || '').slice(0, 300);
  await touchDevice(req, sn, info ? { deviceInfo: info } : {});
  let commands = '';
  try {
    commands = await collectCommands(sn);
  } catch (err: any) {
    console.error('[ADMS] Failed to collect commands', err);
    await logSync('COMMAND', 'ERROR', `Queued commands could not be read: ${err?.message || err}`, { deviceSerial: sn });
  }
  reply(res, commands || 'OK');
}));

// The machine's answer to each command; this, not the act of queueing, decides success
router.post(/^\/devicecmd(\.aspx)?$/, asyncHandler(async (req: Request, res: Response) => {
  const sn = serialOf(req);
  await touchDevice(req, sn);
  try {
    await recordCommandResults(sn, typeof req.body === 'string' ? req.body : '');
  } catch (err: any) {
    console.error('[ADMS] Failed to record command results', err);
    await logSync('COMMAND', 'ERROR', `Command replies could not be stored: ${err?.message || err}`, { deviceSerial: sn });
    return reply(res, 'ERROR', 500);
  }
  reply(res, 'OK');
}));

router.all('*', (_req, res) => reply(res, 'OK'));

export default router;
