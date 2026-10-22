import mongoose from 'mongoose';
import { env } from '../config/env';
import { Student, IStudent } from '../models/Student';
import { Attendance } from '../models/Attendance';
import { BiometricPunch, BiometricDevice, IBiometricPunch, PunchDirection } from '../models/BiometricPunch';
import { AppError } from '../middleware/errorHandler';
import { StudentBatchAllocation } from '../models/tracking/StudentBatchAllocation';
import { Subject } from '../models/tracking/Subject';
import { BiometricDeviceUser } from '../models/BiometricIntegration';
import { raiseENumberSeq } from '../models/Counter';
import { deviceCardCandidates, logSync } from './biometricShared';

// ---------- device-local time helpers (device timestamps carry no zone) ----------

const OFFSET_MS = () => env.BIOMETRIC_TZ_OFFSET_MINUTES * 60000;

export const toLocalParts = (d: Date) => {
  const iso = new Date(d.getTime() + OFFSET_MS()).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 19) };
};

export const fromLocal = (date: string, time: string) => new Date(Date.parse(`${date}T${time}Z`) - OFFSET_MS());

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday

export const inShift = (time: string) => time.slice(0, 5) >= env.BIOMETRIC_SHIFT_START && time.slice(0, 5) <= env.BIOMETRIC_SHIFT_END;

// ---------- ATTLOG ingestion ----------

const directionFromState = (state: number): PunchDirection => {
  if ([0, 3, 4].includes(state)) return 'IN'; // check-in, break-in, OT-in
  if ([1, 2, 5].includes(state)) return 'OUT'; // check-out, break-out, OT-out
  return 'UNKNOWN';
};

// ATTLOG line: PIN \t YYYY-MM-DD HH:mm:ss \t state \t verify \t workcode ...
const ATTLOG_LINE = /^\s*(\S+)\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})(?:\s+(\d+))?(?:\s+(\d+))?/;

export const parseAttlog = (body: string) =>
  body
    .split(/\r?\n/)
    .map((line) => {
      const m = ATTLOG_LINE.exec(line);
      if (!m) return null;
      const stateCode = m[4] !== undefined ? Number(m[4]) : 255;
      return {
        userPin: m[1],
        localDate: m[2],
        localTime: m[3],
        stateCode,
        direction: directionFromState(stateCode),
        verifyMode: m[5] !== undefined ? Number(m[5]) : 0,
        rawLine: line.trim(),
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

/**
 * A device PIN belongs to a student only when it equals their Biometric ID (E Number) exactly.
 * Nothing is inferred from Student IDs or names. A PIN whose card, as the machine itself reports
 * it, is registered in ScholarLogic to a different student is held back as a conflict.
 */
export const resolvePins = async (pins: string[], deviceSerial?: string) => {
  const unique = [...new Set(pins)];
  const students = new Map<string, mongoose.Types.ObjectId>();
  const conflicts = new Map<string, string>();
  if (!unique.length) return { students, conflicts };

  const assigned = await Student.find({ biometricId: { $in: unique } }).select('biometricId').lean();
  assigned.forEach((s: any) => students.set(s.biometricId, s._id));
  if (!students.size) return { students, conflicts };

  const deviceUsers = await BiometricDeviceUser.find({ pin: { $in: [...students.keys()] }, ...(deviceSerial ? { deviceSerial } : {}) }).lean();
  for (const u of deviceUsers) {
    const cards = deviceCardCandidates(u.card);
    const owner = students.get(u.pin);
    if (!cards.length || !owner) continue;
    const other = await Student.findOne({ cardNumber: { $in: cards }, _id: { $ne: owner } }).select('studentId').lean();
    if (other) {
      conflicts.set(u.pin, `The machine has card ${u.card} under ID ${u.pin}, but that card is registered to ${(other as any).studentId}`);
      students.delete(u.pin);
    }
  }
  return { students, conflicts };
};

const isRealDate = (d: Date) => !Number.isNaN(d.getTime());

export const ingestAttlog = async (deviceSerial: string, body: string) => {
  const lineCount = body.split(/\r?\n/).filter((l) => l.trim()).length;
  const punches = parseAttlog(body)
    .map((p) => ({ ...p, punchTime: fromLocal(p.localDate, p.localTime) }))
    .filter((p) => isRealDate(p.punchTime));
  const malformed = lineCount - punches.length;
  const counts = { received: punches.length, inserted: 0, duplicates: 0, unknown: 0, conflicts: 0, outOfWindow: 0, malformed };
  if (malformed) {
    await logSync('ATTLOG', 'WARN', `${malformed} line(s) in an attendance upload could not be read and were skipped`, {
      deviceSerial,
      meta: { sample: body.slice(0, 300) },
    });
  }
  if (!punches.length) return counts;

  const { students, conflicts } = await resolvePins(punches.map((p) => p.userPin), deviceSerial);
  // The punch is stored exactly as received, once: a re-upload matches the same device + ID + time and changes nothing
  const res = await BiometricPunch.bulkWrite(
    punches.map((p) => {
      const studentId = students.get(p.userPin);
      const review: Partial<IBiometricPunch> = studentId
        ? { studentId }
        : conflicts.has(p.userPin)
          ? { reviewReason: 'ID_CONFLICT', reviewNote: conflicts.get(p.userPin) }
          : { reviewReason: 'UNKNOWN_ID' };
      return {
        updateOne: {
          filter: { deviceSerial, userPin: p.userPin, punchTime: p.punchTime },
          update: { $setOnInsert: { ...p, deviceSerial, ...review } },
          upsert: true,
        },
      };
    }),
    { ordered: false }
  );

  Object.keys(res.upsertedIds || {}).forEach((i) => {
    const p = punches[Number(i)];
    if (!p) return;
    if (conflicts.has(p.userPin)) counts.conflicts += 1;
    else if (!students.has(p.userPin)) counts.unknown += 1;
    if (!inShift(p.localTime)) counts.outOfWindow += 1;
  });
  counts.inserted = res.upsertedCount;
  counts.duplicates = counts.received - counts.inserted;

  const latest = punches.reduce((max, p) => (p.punchTime > max ? p.punchTime : max), new Date(0));
  await BiometricDevice.updateOne(
    { serialNumber: deviceSerial },
    {
      $max: { lastPunchAt: latest },
      $inc: { totalPunches: res.upsertedCount },
      $set: { lastSyncAt: new Date(), lastSyncReceived: counts.received, lastSyncInserted: counts.inserted },
    },
    { upsert: true }
  );

  const needsReview = counts.unknown + counts.conflicts + counts.outOfWindow;
  await logSync(
    'ATTLOG',
    needsReview ? 'WARN' : 'INFO',
    `${counts.received} punch(es) received: ${counts.inserted} new, ${counts.duplicates} already stored` +
      (needsReview ? `; for review: ${counts.unknown} unknown ID, ${counts.conflicts} conflicting ID, ${counts.outOfWindow} outside ${env.BIOMETRIC_SHIFT_START}–${env.BIOMETRIC_SHIFT_END}` : ''),
    { deviceSerial, meta: counts }
  );

  return counts;
};

/**
 * Re-checks punches that are not linked to a student (optionally only the given machine IDs)
 * against the current Biometric IDs. Links exact matches; everything else stays in the review queue.
 */
export const rematchPunches = async (pins?: string[]) => {
  const scope = { studentId: { $exists: false }, ...(pins ? { userPin: { $in: pins } } : {}) };
  const waiting: string[] = await BiometricPunch.distinct('userPin', scope);
  const result = { linked: 0, conflicts: 0, unknown: 0 };
  if (!waiting.length) return result;

  const { students, conflicts } = await resolvePins(waiting);
  for (const pin of waiting) {
    const studentId = students.get(pin);
    if (studentId) {
      const r = await BiometricPunch.updateMany(
        { studentId: { $exists: false }, userPin: pin },
        { $set: { studentId }, $unset: { reviewReason: 1, reviewNote: 1 } }
      );
      result.linked += r.modifiedCount;
    } else if (conflicts.has(pin)) {
      const r = await BiometricPunch.updateMany(
        { studentId: { $exists: false }, userPin: pin },
        { $set: { reviewReason: 'ID_CONFLICT', reviewNote: conflicts.get(pin) } }
      );
      result.conflicts += r.matchedCount;
    } else {
      const r = await BiometricPunch.updateMany(
        { studentId: { $exists: false }, userPin: pin },
        { $set: { reviewReason: 'UNKNOWN_ID' }, $unset: { reviewNote: 1 } }
      );
      result.unknown += r.matchedCount;
    }
  }
  return result;
};

// Links punches that arrived before the student had their Biometric ID
const linkOrphanPunches = async (student: Pick<IStudent, 'biometricId'>) => {
  if (student.biometricId) await rematchPunches([student.biometricId]);
};

// ---------- daily attendance ----------

export type DayStatus = 'PRESENT' | 'INCOMPLETE' | 'ABSENT' | 'EXCUSED' | 'WEEK_OFF';

export interface DayEntry {
  status: DayStatus;
  source: 'BIOMETRIC' | 'MANUAL' | 'AUTO';
  inTime?: string;
  outTime?: string;
}

/**
 * A valid IN followed by an OUT inside the shift = Present; an IN alone = Incomplete.
 * Many devices are left on a single state key, so when the punches do not carry a
 * mix of IN and OUT codes the first punch is the IN and the last (a minute+ later) the OUT.
 */
export const evaluateDay = (punches: { localTime: string; direction: PunchDirection }[]): DayEntry | null => {
  const inside = punches.filter((p) => inShift(p.localTime)).sort((a, b) => a.localTime.localeCompare(b.localTime));
  if (!inside.length) return null;

  const hasMix = inside.some((p) => p.direction === 'IN') && inside.some((p) => p.direction === 'OUT');
  if (hasMix) {
    const firstIn = inside.find((p) => p.direction === 'IN')!;
    const lastOut = [...inside].reverse().find((p) => p.direction === 'OUT' && p.localTime > firstIn.localTime);
    return lastOut
      ? { status: 'PRESENT', source: 'BIOMETRIC', inTime: firstIn.localTime, outTime: lastOut.localTime }
      : { status: 'INCOMPLETE', source: 'BIOMETRIC', inTime: firstIn.localTime };
  }

  const first = inside[0];
  const last = inside[inside.length - 1];
  if (!env.BIOMETRIC_PAIR_SINGLE_STATE) return { status: 'INCOMPLETE', source: 'BIOMETRIC', inTime: first.localTime };
  const gapMs = Date.parse(`1970-01-01T${last.localTime}Z`) - Date.parse(`1970-01-01T${first.localTime}Z`);
  return gapMs >= 60000
    ? { status: 'PRESENT', source: 'BIOMETRIC', inTime: first.localTime, outTime: last.localTime }
    : { status: 'INCOMPLETE', source: 'BIOMETRIC', inTime: first.localTime };
};

const manualToDay = (status: string): DayEntry =>
  status === 'PRESENT' || status === 'LATE'
    ? { status: 'PRESENT', source: 'MANUAL' }
    : status === 'EXCUSED'
      ? { status: 'EXCUSED', source: 'MANUAL' }
      : { status: 'ABSENT', source: 'MANUAL' };

const summarize = (days: Record<string, DayEntry>) => {
  const values = Object.values(days);
  const present = values.filter((d) => d.status === 'PRESENT').length;
  const incomplete = values.filter((d) => d.status === 'INCOMPLETE').length;
  const absent = values.filter((d) => d.status === 'ABSENT').length;
  const total = present + incomplete + absent;
  return { present, incomplete, absent, total, percentage: total ? Math.round((present / total) * 100) : null };
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const getStudentAttendanceCalendar = async (student: IStudent, query: { from?: string; to?: string }) => {
  const now = toLocalParts(new Date());
  const today = now.date;
  const to = query.to && DATE_RE.test(query.to) && query.to < today ? query.to : today;
  let from = query.from && DATE_RE.test(query.from) ? query.from : `${addDays(today, -95).slice(0, 7)}-01`;
  if (from > to) from = to;
  if (Date.parse(to) - Date.parse(from) > 400 * 86400000) from = addDays(to, -400);

  await linkOrphanPunches(student);

  const joinedOn = toLocalParts(new Date(student.enrollment?.joiningDate || student.enrollmentDate || student.createdAt)).date;
  const isOffline = (student.enrollment?.mode || 'OFFLINE') === 'OFFLINE';
  const shiftOver = now.time.slice(0, 5) > env.BIOMETRIC_SHIFT_END;

  const [myPunches, campusOpenDays, sessions, allocations] = await Promise.all([
    BiometricPunch.find({ studentId: student._id, localDate: { $gte: from, $lte: to } })
      .select('localDate localTime direction')
      .lean(),
    // A day counts as a class day only if the campus machine saw someone (skips holidays automatically)
    BiometricPunch.distinct('localDate', { localDate: { $gte: from, $lte: to } }),
    Attendance.find({
      'records.studentId': student._id,
      date: { $gte: fromLocal(from, '00:00:00'), $lte: fromLocal(to, '23:59:59') },
    })
      .select('date batchId records')
      .lean(),
    StudentBatchAllocation.find({ studentId: student._id }).select('batchId subjectId startDate allocationDate endDate').lean(),
  ]);

  const punchesByDay = new Map<string, { localTime: string; direction: PunchDirection }[]>();
  myPunches.forEach((p: any) => {
    const list = punchesByDay.get(p.localDate) || [];
    list.push(p);
    punchesByDay.set(p.localDate, list);
  });
  const openDays = new Set<string>(campusOpenDays as string[]);

  // Manual marks by day, overall and per batch
  const manualByDay = new Map<string, string[]>();
  const manualByBatchDay = new Map<string, string>();
  sessions.forEach((s: any) => {
    const rec = (s.records || []).find((r: any) => String(r.studentId) === String(student._id));
    if (!rec) return;
    const day = toLocalParts(new Date(s.date)).date;
    manualByDay.set(day, [...(manualByDay.get(day) || []), rec.status]);
    if (s.batchId) manualByBatchDay.set(`${s.batchId}|${day}`, rec.status);
  });

  const overall: Record<string, DayEntry> = {};
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const bio = evaluateDay(punchesByDay.get(d) || []);
    const manual = manualByDay.get(d);
    if (bio && (bio.status === 'PRESENT' || !manual?.some((s) => s === 'PRESENT' || s === 'LATE'))) {
      overall[d] = bio;
    } else if (manual?.length) {
      const best = manual.find((s) => s === 'PRESENT' || s === 'LATE') || manual.find((s) => s === 'EXCUSED') || manual[0];
      overall[d] = manualToDay(best);
    } else if (weekday(d) === 0) {
      overall[d] = { status: 'WEEK_OFF', source: 'AUTO' };
    } else if (isOffline && d >= joinedOn && openDays.has(d) && (d < today || shiftOver)) {
      overall[d] = { status: 'ABSENT', source: 'AUTO' };
    }
  }

  // Per-subject view: the days the student was seated in that subject's batch
  const subjectNames = new Map(
    (await Subject.find({ _id: { $in: allocations.map((a: any) => a.subjectId) } }).select('name').lean()).map((s: any) => [
      String(s._id),
      s.name,
    ])
  );
  const subjectDays = new Map<string, Record<string, DayEntry>>();
  allocations.forEach((a: any) => {
    const start = toLocalParts(new Date(a.startDate || a.allocationDate)).date;
    const end = a.endDate ? toLocalParts(new Date(a.endDate)).date : to;
    const days = subjectDays.get(String(a.subjectId)) || {};
    for (let d = start > from ? start : from; d <= (end < to ? end : to); d = addDays(d, 1)) {
      const batchMark = manualByBatchDay.get(`${a.batchId}|${d}`);
      if (batchMark && !(overall[d]?.source === 'BIOMETRIC' && overall[d].status === 'PRESENT')) days[d] = manualToDay(batchMark);
      else if (overall[d]) days[d] = overall[d];
    }
    subjectDays.set(String(a.subjectId), days);
  });

  const lastPunch = await BiometricPunch.findOne({ studentId: student._id }).sort({ punchTime: -1 }).select('punchTime direction').lean();

  return {
    from,
    to,
    today,
    mode: isOffline ? 'OFFLINE' : 'ONLINE',
    shift: { start: env.BIOMETRIC_SHIFT_START, end: env.BIOMETRIC_SHIFT_END },
    lastPunchAt: lastPunch?.punchTime || null,
    tabs: [
      { key: 'overall', label: 'Overall', days: overall, summary: summarize(overall) },
      ...[...subjectDays.entries()].map(([subjectId, days]) => ({
        key: subjectId,
        label: subjectNames.get(subjectId) || 'Subject',
        days,
        summary: summarize(days),
      })),
    ],
  };
};

// ---------- admin live monitor ----------

// The device polls every few seconds while connected; silence for longer than this means offline
export const DEVICE_ONLINE_WINDOW_MS = 3 * 60000;

export type LiveStatus = 'PRESENT' | 'IN_CAMPUS' | 'INCOMPLETE' | 'NOT_PUNCHED' | 'ABSENT' | 'WEEK_OFF';

export const getBiometricLive = async (query: { date?: string }) => {
  const now = toLocalParts(new Date());
  const date = query.date && DATE_RE.test(query.date) && query.date <= now.date ? query.date : now.date;
  const isToday = date === now.date;
  const dayOver = !isToday || now.time.slice(0, 5) > env.BIOMETRIC_SHIFT_END;

  const [devices, punches, unmatched] = await Promise.all([
    BiometricDevice.find().sort({ lastSeenAt: -1 }).lean(),
    BiometricPunch.find({ localDate: date }).sort({ punchTime: -1 }).select('userPin localTime direction studentId verifyMode').lean(),
    BiometricPunch.aggregate([
      { $match: { studentId: { $exists: false } } },
      { $group: { _id: '$userPin', punches: { $sum: 1 }, lastPunchAt: { $max: '$punchTime' }, reason: { $max: '$reviewReason' }, note: { $max: '$reviewNote' } } },
      { $sort: { lastPunchAt: -1 } },
      { $limit: 100 },
    ]),
  ]);

  // Everyone expected on campus, plus anyone else who punched that day
  const punchedIds = [...new Set(punches.filter((p: any) => p.studentId).map((p: any) => String(p.studentId)))];
  const students = await Student.find({
    $or: [{ accountStatus: 'ACTIVE', 'enrollment.mode': { $ne: 'ONLINE' } }, { _id: { $in: punchedIds } }],
  })
    .select('studentId biometricId userId enrollment.mode')
    .populate('userId', 'fullName')
    .lean();
  const byId = new Map(students.map((s: any) => [String(s._id), s]));

  // Every active student, so an unknown machine ID can be assigned to anyone (online students too)
  const directory = (
    await Student.find({ accountStatus: 'ACTIVE' }).select('studentId biometricId userId').populate('userId', 'fullName').lean()
  )
    .map((s: any) => ({ _id: s._id, name: s.userId?.fullName || '—', studentId: s.studentId, biometricId: s.biometricId || '' }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const punchesByStudent = new Map<string, any[]>();
  punches.forEach((p: any) => {
    if (!p.studentId) return;
    const key = String(p.studentId);
    punchesByStudent.set(key, [...(punchesByStudent.get(key) || []), p]);
  });

  const rows = students.map((s: any) => {
    const day = evaluateDay(punchesByStudent.get(String(s._id)) || []);
    let status: LiveStatus;
    if (day?.status === 'PRESENT') status = 'PRESENT';
    else if (day?.status === 'INCOMPLETE') status = dayOver ? 'INCOMPLETE' : 'IN_CAMPUS';
    else if (weekday(date) === 0) status = 'WEEK_OFF';
    else status = dayOver ? 'ABSENT' : 'NOT_PUNCHED';
    return {
      _id: s._id,
      name: s.userId?.fullName || '—',
      studentId: s.studentId,
      biometricId: s.biometricId || '',
      mode: s.enrollment?.mode || 'OFFLINE',
      status,
      inTime: day?.inTime || null,
      outTime: day?.outTime || null,
      punchCount: (punchesByStudent.get(String(s._id)) || []).length,
    };
  });

  const count = (st: LiveStatus) => rows.filter((r) => r.status === st).length;

  return {
    date,
    isToday,
    shift: { start: env.BIOMETRIC_SHIFT_START, end: env.BIOMETRIC_SHIFT_END },
    devices: devices.map((d: any) => ({
      serialNumber: d.serialNumber,
      lastSeenAt: d.lastSeenAt,
      lastPunchAt: d.lastPunchAt || null,
      lastIp: d.lastIp,
      totalPunches: d.totalPunches,
      online: Date.now() - new Date(d.lastSeenAt).getTime() < DEVICE_ONLINE_WINDOW_MS,
      lastSyncAt: d.lastSyncAt || null,
      lastErrorAt: d.lastErrorAt || null,
      lastError: d.lastError || '',
    })),
    summary: {
      punches: punches.length,
      present: count('PRESENT'),
      inCampus: count('IN_CAMPUS'),
      incomplete: count('INCOMPLETE'),
      notPunched: count('NOT_PUNCHED'),
      absent: count('ABSENT'),
      unmatched: unmatched.length,
    },
    directory,
    students: rows.sort((a, b) => (b.inTime || '').localeCompare(a.inTime || '') || a.name.localeCompare(b.name)),
    feed: punches.slice(0, 100).map((p: any) => {
      const s = p.studentId ? byId.get(String(p.studentId)) : null;
      return {
        _id: p._id,
        time: p.localTime,
        direction: p.direction,
        userPin: p.userPin,
        studentMongoId: s?._id || null,
        name: s?.userId?.fullName || null,
        studentId: s?.studentId || null,
      };
    }),
    unmatchedPins: unmatched.map((u: any) => ({
      userPin: u._id,
      punches: u.punches,
      lastPunchAt: u.lastPunchAt,
      reason: u.reason || 'UNKNOWN_ID',
      note: u.note || '',
    })),
  };
};

export const BIOMETRIC_ID_RE = /^[A-Za-z0-9-]{1,24}$/;

// E Numbers ScholarLogic generates itself: plain numbers, as the machine's user ID field expects
export const NUMERIC_E_NUMBER_RE = /^[1-9]\d{0,8}$/;

// Sets (or clears, with '') the ID a student is enrolled under on the machine and moves that ID's punches to them
export const assignBiometricId = async (studentMongoId: string, rawId: string) => {
  const biometricId = String(rawId ?? '').trim();
  if (biometricId && !BIOMETRIC_ID_RE.test(biometricId)) {
    throw new AppError('Biometric ID can only contain letters, numbers and dashes (max 24)', 400, 'VALIDATION_ERROR');
  }
  const student = await Student.findById(studentMongoId);
  if (!student) throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');

  if (biometricId) {
    const taken = await Student.findOne({ biometricId, _id: { $ne: student._id } }).select('studentId').lean();
    if (taken) throw new AppError(`Biometric ID ${biometricId} is already assigned to ${(taken as any).studentId}`, 409, 'DUPLICATE');
  }

  const previous = student.biometricId;
  await Student.updateOne({ _id: student._id }, biometricId ? { $set: { biometricId } } : { $unset: { biometricId: 1 } });

  // A hand-entered number must never be handed out again by the sequence
  if (NUMERIC_E_NUMBER_RE.test(biometricId)) await raiseENumberSeq(Number(biometricId));

  // Punches under the old ID were matched through it; release them back to the review queue
  if (previous && previous !== biometricId) {
    await BiometricPunch.updateMany({ userPin: previous, studentId: student._id }, { $unset: { studentId: 1 }, $set: { reviewReason: 'UNKNOWN_ID' } });
  }
  const relinked = biometricId ? (await rematchPunches([biometricId])).linked : 0;
  return { studentId: student.studentId, biometricId, relinked };
};
