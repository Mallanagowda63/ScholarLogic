import mongoose from 'mongoose';
import * as XLSX from 'xlsx';
import { env } from '../config/env';
import { Student } from '../models/Student';
import { Counter, E_NUMBER_COUNTER, nextENumberSeq, raiseENumberSeq } from '../models/Counter';
import { BiometricPunch, BiometricDevice } from '../models/BiometricPunch';
import {
  BiometricCommand,
  BiometricDeviceUser,
  BiometricSettings,
  BiometricSyncLog,
  IBiometricCommand,
} from '../models/BiometricIntegration';
import { AppError } from '../middleware/errorHandler';
import { AuthUserPayload } from '../middleware/auth';
import { BIOMETRIC_ID_RE, DEVICE_ONLINE_WINDOW_MS, NUMERIC_E_NUMBER_RE, rematchPunches } from './biometricService';
import { deviceCardCandidates, logSync, normalizeCard } from './biometricShared';

const NO_E_NUMBER = { $or: [{ biometricId: { $exists: false } }, { biometricId: null }, { biometricId: '' }] };

const isDuplicateKey = (err: any) => err?.code === 11000;

// ---------------------------------------------------------------------------
// E Number (= Biometric ID) allocation
// ---------------------------------------------------------------------------

// Highest plain-number Biometric ID already held by a student, so the sequence starts above it
const highestAssignedENumber = async () => {
  const ids: string[] = await Student.distinct('biometricId', { biometricId: { $exists: true } });
  return ids.reduce((max, id) => (NUMERIC_E_NUMBER_RE.test(String(id)) ? Math.max(max, Number(id)) : max), 0);
};

/**
 * Hands out the next free E Number. The counter never goes back, so numbers are not reused, and
 * a number is skipped when it is already in use anywhere the machine could confuse it: held by a
 * student, enrolled on the machine, or seen in punches that are not linked to anyone.
 */
export const allocateENumber = async (): Promise<string> => {
  const floor = Math.max(env.BIOMETRIC_ENUMBER_START - 1, await highestAssignedENumber());
  for (;;) {
    const candidate = String(await nextENumberSeq(floor));
    const [student, deviceUser, strayPunch] = await Promise.all([
      Student.exists({ biometricId: candidate }),
      BiometricDeviceUser.exists({ pin: candidate }),
      BiometricPunch.exists({ userPin: candidate, studentId: { $exists: false } }),
    ]);
    if (!student && !deviceUser && !strayPunch) return candidate;
  }
};

/** Gives the student an E Number unless they already have one (an existing number is never replaced). */
export const ensureENumber = async (studentMongoId: mongoose.Types.ObjectId | string): Promise<{ biometricId: string; assigned: boolean }> => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await Student.findById(studentMongoId).select('biometricId').lean();
    if (!current) throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');
    if ((current as any).biometricId) return { biometricId: (current as any).biometricId, assigned: false };

    const candidate = await allocateENumber();
    try {
      // The filter makes this a no-op if another request assigned a number in the meantime
      const res = await Student.updateOne({ _id: studentMongoId, ...NO_E_NUMBER }, { $set: { biometricId: candidate } });
      if (res.modifiedCount === 1) return { biometricId: candidate, assigned: true };
    } catch (err) {
      // The unique index refused the number (taken by a hand-entered ID a moment ago); take the next one
      if (!isDuplicateKey(err)) throw err;
    }
  }
  throw new AppError('Could not assign an E Number, please try again', 500, 'E_NUMBER_FAILED');
};

/** Assigns E Numbers to the given students (or to every student without one). Safe to run again. */
export const assignENumbers = async (studentIds?: string[]) => {
  if (!env.BIOMETRIC_AUTO_ENUMBER) {
    throw new AppError('Machine codes are given in eSSL Web. Link students from the Review queue when their code appears on the machine.', 409, 'AUTO_ENUMBER_OFF');
  }
  const filter: any = { ...NO_E_NUMBER };
  if (studentIds?.length) filter._id = { $in: studentIds };
  // Oldest first, so numbers follow the order students joined
  const students = await Student.find(filter).sort({ createdAt: 1 }).select('studentId').lean();
  const assigned: { _id: string; studentId: string; biometricId: string }[] = [];
  const failed: { studentId: string; message: string }[] = [];
  for (const s of students as any[]) {
    try {
      const res = await ensureENumber(s._id);
      if (res.assigned) assigned.push({ _id: String(s._id), studentId: s.studentId, biometricId: res.biometricId });
    } catch (err: any) {
      failed.push({ studentId: s.studentId, message: err.message });
    }
  }
  if (assigned.length || failed.length) {
    await logSync('E_NUMBER', failed.length ? 'ERROR' : 'INFO', `${assigned.length} E Number(s) assigned${failed.length ? `, ${failed.length} failed` : ''}`, {
      meta: { assigned: assigned.map((a) => `${a.studentId}=${a.biometricId}`), failed },
    });
  }
  return { assigned, failed, alreadyAssigned: (studentIds?.length || 0) > 0 ? studentIds!.length - students.length : 0 };
};

/** For new accounts: an E Number failure must not stop the student from being created. */
export const assignENumberQuietly = async (studentMongoId: mongoose.Types.ObjectId) => {
  // Codes come from eSSL Web; the student is linked when their code shows up on the machine
  if (!env.BIOMETRIC_AUTO_ENUMBER) return undefined;
  try {
    return (await ensureENumber(studentMongoId)).biometricId;
  } catch (err: any) {
    await logSync('E_NUMBER', 'ERROR', `Could not assign an E Number to a new student: ${err.message}`, { meta: { studentMongoId: String(studentMongoId) } });
    return undefined;
  }
};

// ---------------------------------------------------------------------------
// Card number
// ---------------------------------------------------------------------------

const CARD_RE = /^[1-9]\d{0,19}$/;

/** Sets (or clears, with '') the student's card. The card hangs off the student's own Biometric ID. */
export const setCardNumber = async (studentMongoId: string, raw: unknown) => {
  const cardNumber = normalizeCard(raw);
  if (cardNumber && !CARD_RE.test(cardNumber)) throw new AppError('Card Number must contain digits only', 400, 'VALIDATION_ERROR');

  const student = await Student.findById(studentMongoId).select('studentId biometricId cardNumber');
  if (!student) throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');

  if (cardNumber) {
    const taken = await Student.findOne({ cardNumber, _id: { $ne: student._id } }).select('studentId').lean();
    if (taken) throw new AppError(`Card ${cardNumber} is already linked to ${(taken as any).studentId}`, 409, 'DUPLICATE');
  }

  if (cardNumber && !student.biometricId && !env.BIOMETRIC_AUTO_ENUMBER) {
    throw new AppError('Link this student to their machine code (e.g. SCLR245) before adding a card', 409, 'NO_E_NUMBER');
  }
  const biometricId = cardNumber ? (await ensureENumber(student._id)).biometricId : student.biometricId || '';
  try {
    await Student.updateOne({ _id: student._id }, cardNumber ? { $set: { cardNumber } } : { $unset: { cardNumber: 1 } });
  } catch (err) {
    if (isDuplicateKey(err)) throw new AppError(`Card ${cardNumber} is already linked to another student`, 409, 'DUPLICATE');
    throw err;
  }
  // A card that was the reason punches were held back may now belong to the right student
  await rematchPunches();
  return { studentId: student.studentId, biometricId, cardNumber };
};

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const SETTINGS_KEY = 'essl';

export const getSettings = async () => {
  try {
    return (await BiometricSettings.findOneAndUpdate({ key: SETTINGS_KEY }, { $setOnInsert: { key: SETTINGS_KEY } }, { new: true, upsert: true }))!;
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
    return (await BiometricSettings.findOne({ key: SETTINGS_KEY }))!;
  }
};

const text = (v: unknown, max = 100) => String(v ?? '').trim().slice(0, max);

export const updateSettings = async (body: any) => {
  const settings = await getSettings();
  const d = body?.defaults || {};
  (['company', 'department', 'designation', 'applyType'] as const).forEach((k) => {
    if (d[k] !== undefined) settings.defaults[k] = text(d[k]);
  });
  if (Array.isArray(body?.applyTypeAllowed)) {
    settings.applyTypeAllowed = [...new Set((body.applyTypeAllowed as unknown[]).map((v) => text(v)).filter(Boolean))];
  }
  await settings.save();
  return settings;
};

// ---------------------------------------------------------------------------
// eSSL master sheet: import
// ---------------------------------------------------------------------------

type ColumnKey = 'eNumber' | 'name' | 'company' | 'department' | 'designation' | 'applyType' | 'cardNumber' | 'studentRef';

// Canonical eSSL master columns, in export order
const MASTER_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: 'eNumber', label: 'E Number' },
  { key: 'name', label: 'Name' },
  { key: 'company', label: 'Company' },
  { key: 'department', label: 'Department' },
  { key: 'designation', label: 'Designation' },
  { key: 'applyType', label: 'Apply Type' },
];

// Header text (lower-cased, letters and digits only) → column. Card Number and Student ID are optional extras.
const HEADER_KEYS: Record<string, ColumnKey> = {
  enumber: 'eNumber',
  eno: 'eNumber',
  name: 'name',
  company: 'company',
  department: 'department',
  designation: 'designation',
  applytype: 'applyType',
  cardnumber: 'cardNumber',
  cardno: 'cardNumber',
  studentid: 'studentRef',
};

const headerKey = (cell: unknown) => HEADER_KEYS[String(cell ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')];

const cellText = (v: unknown) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  return String(v).trim();
};

const normName = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

export type ImportAction = 'LINK' | 'UPDATE' | 'UNCHANGED' | 'SKIP' | 'ERROR';

export interface ImportRow {
  row: number; // row number in the sheet
  eNumber: string;
  name: string;
  company: string;
  department: string;
  designation: string;
  applyType: string;
  cardNumber: string;
  studentRef: string;
  action: ImportAction;
  errors: string[];
  warnings: string[];
  changes: string[];
  student: { _id: string; studentId: string; name: string } | null;
  result?: 'APPLIED' | 'UNCHANGED' | 'SKIPPED' | 'INVALID' | 'FAILED';
  resultMessage?: string;
}

const MAX_IMPORT_ROWS = 5000;

const readSheet = (buffer: Buffer, fileName: string) => {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    throw new AppError(`"${fileName}" could not be read as an Excel or CSV file`, 400, 'INVALID_FILE');
  }
  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheet || !sheet['!ref']) throw new AppError('The file has no data', 400, 'INVALID_FILE');

  const firstRow = XLSX.utils.decode_range(sheet['!ref']).s.r;
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '', blankrows: true });

  // The header row is the first of the leading rows that names both the E Number and the Name column
  const headerIndex = grid.slice(0, 15).findIndex((r) => {
    const keys = (r || []).map(headerKey);
    return keys.includes('eNumber') && keys.includes('name');
  });
  if (headerIndex < 0) {
    const seen = (grid.find((r) => (r || []).some((c) => cellText(c))) || []).map(cellText).filter(Boolean);
    throw new AppError(
      `Could not find the "E Number" and "Name" columns. Columns found: ${seen.join(', ') || 'none'}. Use the eSSL master template.`,
      400,
      'INVALID_TEMPLATE'
    );
  }

  const headers = (grid[headerIndex] || []).map(cellText);
  const columns = new Map<ColumnKey, number>();
  headers.forEach((h, i) => {
    const key = headerKey(h);
    if (key && !columns.has(key)) columns.set(key, i);
  });
  const missing = MASTER_COLUMNS.filter((c) => !columns.has(c.key)).map((c) => c.label);
  if (missing.length) {
    throw new AppError(`The file is missing the column(s): ${missing.join(', ')}. Columns found: ${headers.filter(Boolean).join(', ')}.`, 400, 'INVALID_TEMPLATE');
  }

  const records = grid
    .slice(headerIndex + 1)
    .map((cells, i) => {
      const get = (key: ColumnKey) => (columns.has(key) ? cellText((cells || [])[columns.get(key)!]) : '');
      return {
        row: firstRow + headerIndex + 2 + i,
        eNumber: get('eNumber'),
        name: get('name').replace(/\s+/g, ' '),
        company: get('company'),
        department: get('department'),
        designation: get('designation'),
        applyType: get('applyType'),
        cardNumber: get('cardNumber'),
        studentRef: get('studentRef').toUpperCase(),
        blank: !(cells || []).some((c) => cellText(c)),
      };
    })
    .filter((r) => !r.blank);

  if (!records.length) throw new AppError('The file has a header row but no student rows', 400, 'INVALID_FILE');
  if (records.length > MAX_IMPORT_ROWS) throw new AppError(`The file has more than ${MAX_IMPORT_ROWS} rows`, 400, 'INVALID_FILE');
  return { sheetName, headers, records, hasCardColumn: columns.has('cardNumber'), hasStudentIdColumn: columns.has('studentRef') };
};

const countBy = <T,>(items: T[], key: (item: T) => string) => {
  const map = new Map<string, number>();
  items.forEach((item) => {
    const k = key(item);
    if (k) map.set(k, (map.get(k) || 0) + 1);
  });
  return map;
};

/** Reads the file and works out, row by row, what an import would do. Changes nothing. */
export const analyzeImport = async (buffer: Buffer, fileName: string) => {
  const { sheetName, headers, records, hasCardColumn, hasStudentIdColumn } = readSheet(buffer, fileName);
  const settings = await getSettings();
  const allowedApplyTypes = new Map(settings.applyTypeAllowed.map((v) => [v.toLowerCase(), v]));

  const students = (await Student.find().select('studentId biometricId cardNumber essl userId').populate('userId', 'fullName').lean()) as any[];
  const nameOf = (s: any) => s.userId?.fullName || '';
  const byStudentId = new Map(students.map((s) => [s.studentId, s]));
  const byENumber = new Map(students.filter((s) => s.biometricId).map((s) => [s.biometricId, s]));
  const byCard = new Map(students.filter((s) => s.cardNumber).map((s) => [s.cardNumber, s]));
  const byName = new Map<string, any[]>();
  students.forEach((s) => {
    const key = normName(nameOf(s));
    if (key) byName.set(key, [...(byName.get(key) || []), s]);
  });

  const eNumberCount = countBy(records, (r) => r.eNumber);
  const cardCount = countBy(records, (r) => normalizeCard(r.cardNumber));

  const rows: ImportRow[] = records.map(({ blank: _blank, ...r }) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const changes: string[] = [];
    const card = normalizeCard(r.cardNumber);

    // ----- field validation -----
    if (!r.eNumber) errors.push('E Number is blank');
    else if (!BIOMETRIC_ID_RE.test(r.eNumber)) errors.push('E Number may only contain letters, numbers and dashes (max 24)');
    else if (eNumberCount.get(r.eNumber)! > 1) errors.push(`E Number ${r.eNumber} appears ${eNumberCount.get(r.eNumber)} times in the file`);
    else if (!NUMERIC_E_NUMBER_RE.test(r.eNumber)) warnings.push('E Number is not a plain number; check that the machine accepts it as a user ID');
    if (!r.name) errors.push('Name is blank');
    if (!r.company) warnings.push('Company is blank');
    if (!r.department) warnings.push('Department is blank');
    if (!r.designation) warnings.push('Designation is blank');
    if (!r.applyType) warnings.push('Apply Type is blank');
    else if (allowedApplyTypes.size && !allowedApplyTypes.has(r.applyType.toLowerCase())) {
      errors.push(`Apply Type "${r.applyType}" is not one of: ${settings.applyTypeAllowed.join(', ')}`);
    }
    if (card) {
      if (!CARD_RE.test(card)) errors.push('Card Number must contain digits only');
      else if (cardCount.get(card)! > 1) errors.push(`Card Number ${card} appears ${cardCount.get(card)} times in the file`);
    }

    // ----- which student is this row? Never guessed: Student ID, then E Number, then one exact name match -----
    let student: any = null;
    if (!errors.length) {
      const holder = byENumber.get(r.eNumber);
      if (r.studentRef) {
        student = byStudentId.get(r.studentRef) || null;
        if (!student) errors.push(`No student with Student ID ${r.studentRef}`);
      } else if (holder) {
        student = holder;
        if (normName(nameOf(holder)) !== normName(r.name)) warnings.push(`Name differs from ScholarLogic ("${nameOf(holder)}")`);
      } else {
        const matches = byName.get(normName(r.name)) || [];
        if (matches.length === 1) student = matches[0];
        else if (matches.length > 1) errors.push(`${matches.length} students are named "${r.name}"; add a "Student ID" column to say which one`);
      }

      if (student) {
        if (holder && String(holder._id) !== String(student._id)) errors.push(`E Number ${r.eNumber} already belongs to ${holder.studentId}`);
        if (student.biometricId && student.biometricId !== r.eNumber) {
          errors.push(`${student.studentId} already has E Number ${student.biometricId}; an assigned number is not replaced by import`);
        }
        const cardHolder = card ? byCard.get(card) : null;
        if (cardHolder && String(cardHolder._id) !== String(student._id)) errors.push(`Card ${card} is already linked to ${cardHolder.studentId}`);
      }
    }

    if (student && !errors.length) {
      if (!student.biometricId) changes.push(`E Number → ${r.eNumber}`);
      (['company', 'department', 'designation', 'applyType'] as const).forEach((k) => {
        if (r[k] && r[k] !== (student.essl?.[k] || '')) changes.push(`${MASTER_COLUMNS.find((c) => c.key === k)!.label} → ${r[k]}`);
      });
      if (card && card !== (student.cardNumber || '')) changes.push(`Card Number → ${card}`);
    }

    const action: ImportAction = errors.length
      ? 'ERROR'
      : !student
        ? 'SKIP'
        : !student.biometricId
          ? 'LINK'
          : changes.length
            ? 'UPDATE'
            : 'UNCHANGED';
    if (action === 'SKIP') warnings.push('No ScholarLogic student with this name; row will be skipped');

    return {
      ...r,
      cardNumber: card,
      action,
      errors,
      warnings,
      changes,
      student: student ? { _id: String(student._id), studentId: student.studentId, name: nameOf(student) } : null,
    };
  });

  // Two rows must not land on the same student
  const perStudent = countBy(rows.filter((r) => r.student && r.action !== 'ERROR'), (r) => r.student!._id);
  rows.forEach((r) => {
    if (r.student && r.action !== 'ERROR' && perStudent.get(r.student._id)! > 1) {
      r.errors.push(`${perStudent.get(r.student._id)} rows in the file match ${r.student.studentId}`);
      r.action = 'ERROR';
      r.changes = [];
    }
  });

  const count = (a: ImportAction) => rows.filter((r) => r.action === a).length;
  return {
    fileName,
    sheetName,
    headers,
    hasCardColumn,
    hasStudentIdColumn,
    applyTypeValidated: allowedApplyTypes.size > 0,
    rows,
    summary: {
      total: rows.length,
      link: count('LINK'),
      update: count('UPDATE'),
      unchanged: count('UNCHANGED'),
      skip: count('SKIP'),
      error: count('ERROR'),
      warnings: rows.filter((r) => r.warnings.length).length,
    },
  };
};

/** Applies an import. The file is validated again here, so the result reflects the data as it is now. */
export const commitImport = async (buffer: Buffer, fileName: string, actor?: AuthUserPayload) => {
  const analysis = await analyzeImport(buffer, fileName);
  const touchedPins: string[] = [];

  for (const r of analysis.rows) {
    if (r.action === 'ERROR') {
      r.result = 'INVALID';
      r.resultMessage = r.errors.join('; ');
      continue;
    }
    if (r.action === 'SKIP') {
      r.result = 'SKIPPED';
      r.resultMessage = 'No matching ScholarLogic student';
      continue;
    }
    if (r.action === 'UNCHANGED') {
      r.result = 'UNCHANGED';
      continue;
    }

    const set: Record<string, string> = { biometricId: r.eNumber };
    (['company', 'department', 'designation', 'applyType'] as const).forEach((k) => {
      if (r[k]) set[`essl.${k}`] = r[k];
    });
    if (r.cardNumber) set.cardNumber = r.cardNumber;

    try {
      // Only if the student still has no E Number, or already has this one: an assigned number is never overwritten
      const res = await Student.updateOne(
        { _id: r.student!._id, $or: [...NO_E_NUMBER.$or, { biometricId: r.eNumber }] },
        { $set: set }
      );
      if (res.matchedCount === 1) {
        r.result = 'APPLIED';
        r.resultMessage = r.changes.join(', ');
        touchedPins.push(r.eNumber);
      } else {
        r.result = 'FAILED';
        r.resultMessage = 'The student was given a different E Number while this import was running';
      }
    } catch (err: any) {
      r.result = 'FAILED';
      r.resultMessage = isDuplicateKey(err) ? 'E Number or Card Number is already used by another student' : err.message;
    }
  }

  // The sequence must stay ahead of every imported number
  const highest = touchedPins.reduce((max, pin) => (NUMERIC_E_NUMBER_RE.test(pin) ? Math.max(max, Number(pin)) : max), 0);
  if (highest) await raiseENumberSeq(highest);
  const relinked = touchedPins.length ? (await rematchPunches()).linked : 0;

  // Remember the file's own header row so exports come out in the same layout
  await BiometricSettings.updateOne({ key: SETTINGS_KEY }, { $set: { templateHeaders: analysis.headers, templateSheetName: analysis.sheetName } });

  const tally = (res: ImportRow['result']) => analysis.rows.filter((r) => r.result === res).length;
  const results = {
    total: analysis.rows.length,
    applied: tally('APPLIED'),
    unchanged: tally('UNCHANGED'),
    skipped: tally('SKIPPED'),
    invalid: tally('INVALID'),
    failed: tally('FAILED'),
    punchesLinked: relinked,
  };
  await logSync(
    'IMPORT',
    results.failed ? 'ERROR' : results.invalid || results.skipped ? 'WARN' : 'INFO',
    `Master import "${fileName}": ${results.applied} applied, ${results.unchanged} unchanged, ${results.skipped} skipped, ${results.invalid} invalid, ${results.failed} failed`,
    { meta: { ...results, byUserId: actor?.userId } }
  );
  return { ...analysis, results };
};

// ---------------------------------------------------------------------------
// eSSL master sheet: export
// ---------------------------------------------------------------------------

const EXPORT_TYPES = {
  xlsx: { bookType: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  xls: { bookType: 'biff8', mime: 'application/vnd.ms-excel' },
  csv: { bookType: 'csv', mime: 'text/csv' },
} as const;

const exportRows = async (studentIds?: string[]) => {
  const settings = await getSettings();
  const filter: any = { biometricId: { $exists: true, $nin: [null, ''] } };
  if (studentIds?.length) filter._id = { $in: studentIds };
  const students = (await Student.find(filter).select('studentId biometricId cardNumber essl userId').populate('userId', 'fullName').lean()) as any[];
  const rows = students
    .map((s) => ({
      eNumber: s.biometricId as string,
      name: s.userId?.fullName || '',
      company: s.essl?.company || settings.defaults.company,
      department: s.essl?.department || settings.defaults.department,
      designation: s.essl?.designation || settings.defaults.designation,
      applyType: s.essl?.applyType || settings.defaults.applyType,
      cardNumber: s.cardNumber || '',
      studentRef: s.studentId as string,
    }))
    .sort((a, b) => a.eNumber.localeCompare(b.eNumber, undefined, { numeric: true }));
  return { settings, rows };
};

export const buildExport = async (format: string, studentIds?: string[]) => {
  const type = EXPORT_TYPES[format as keyof typeof EXPORT_TYPES];
  if (!type) throw new AppError('Format must be xlsx, xls or csv', 400, 'VALIDATION_ERROR');

  const { settings, rows } = await exportRows(studentIds);
  if (!rows.length) throw new AppError('No students have an E Number yet', 400, 'NOTHING_TO_EXPORT');

  // Same header row as the last eSSL file imported, when there is one; otherwise the six master columns
  const fromTemplate = settings.templateHeaders.filter(Boolean).length > 0;
  const headers = fromTemplate ? settings.templateHeaders : MASTER_COLUMNS.map((c) => c.label);
  const table = [
    headers,
    ...rows.map((r) =>
      headers.map((h) => {
        const key = headerKey(h);
        const value = key ? r[key] : '';
        // Plain numbers stay numbers, as they are when typed into Excel
        return key === 'eNumber' && NUMERIC_E_NUMBER_RE.test(value) ? Number(value) : value;
      })
    ),
  ];

  const sheet = XLSX.utils.aoa_to_sheet(table);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, (settings.templateSheetName || 'Sheet1').slice(0, 31));
  const buffer: Buffer = XLSX.write(workbook, { type: 'buffer', bookType: type.bookType });

  await logSync('EXPORT', 'INFO', `Master export: ${rows.length} student(s) as ${format}`, { meta: { rows: rows.length, fromTemplate } });
  return { buffer, mime: type.mime, fileName: `essl-master-${new Date().toISOString().slice(0, 10)}.${format}`, rows: rows.length, fromTemplate };
};

// ---------------------------------------------------------------------------
// Pushing students to the machine (ADMS commands, answered by the machine itself)
// ---------------------------------------------------------------------------

const RESEND_AFTER_MS = 2 * 60000; // a command the machine has not answered is offered again after this
const MAX_ATTEMPTS = 5;
const COMMANDS_PER_POLL = 20;
const DEVICE_NAME_MAX = 24;

const cleanField = (v: string) => v.replace(/[\t\r\n]+/g, ' ').trim();

/**
 * Only the fields ScholarLogic owns are sent: user ID, name and (when there is one) card.
 * Privilege, password, group and fingerprints already on the machine are left alone.
 */
export const buildUserCommand = (biometricId: string, name: string, cardNumber?: string) =>
  [`${env.BIOMETRIC_USER_COMMAND} PIN=${biometricId}`, `Name=${cleanField(name).slice(0, DEVICE_NAME_MAX)}`, ...(cardNumber ? [`Card=${cardNumber}`] : [])].join('\t');

const nextCommandId = async (): Promise<number> => {
  for (;;) {
    try {
      const c = await Counter.findOneAndUpdate({ name: 'biometric_command' }, { $inc: { seq: 1 }, $setOnInsert: { year: 0 } }, { new: true, upsert: true });
      return c!.seq;
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
    }
  }
};

/** The machine students are pushed to: the configured serial, else the only one that has ever connected. */
export const targetDevice = async () => {
  const devices = await BiometricDevice.find().sort({ lastSeenAt: -1 }).lean();
  const serial = env.BIOMETRIC_DEVICE_SERIALS[0] || (devices[0] as any)?.serialNumber || '';
  const device = (devices as any[]).find((d) => d.serialNumber === serial) || null;
  const online = !!device && Date.now() - new Date(device.lastSeenAt).getTime() < DEVICE_ONLINE_WINDOW_MS;
  return { serial, device, online };
};

const sameName = (a: string, b: string) => {
  const x = a.toLowerCase().replace(/[^a-z0-9]/g, '');
  const y = b.toLowerCase().replace(/[^a-z0-9]/g, '');
  return !x || !y || x.startsWith(y) || y.startsWith(x);
};

export type PushOutcome = 'QUEUED' | 'ALREADY_QUEUED' | 'AWAITING_DEVICE' | 'NOT_QUEUED';

export interface PushResult {
  studentMongoId: string;
  studentId: string;
  name: string;
  biometricId: string;
  outcome: PushOutcome;
  message: string;
}

/**
 * Queues one "write this user" command per student. Nothing here claims the machine has the
 * student: a command is QUEUED until the machine collects it and only its own reply confirms it.
 * Pushing again while a command is live reuses that command.
 */
export const queueStudentPush = async (studentIds: string[], options: { force?: boolean } = {}, actor?: AuthUserPayload) => {
  const ids = [...new Set((studentIds || []).map(String))].filter((id) => mongoose.isValidObjectId(id));
  if (!ids.length) throw new AppError('Select at least one student', 400, 'VALIDATION_ERROR');

  const { serial, device, online } = await targetDevice();
  if (!serial) throw new AppError('No biometric machine is configured (BIOMETRIC_DEVICE_SERIALS is empty and none has connected)', 400, 'NO_DEVICE');
  const waiting = !device
    ? 'The machine has never connected to ScholarLogic, so nothing has been delivered.'
    : online
      ? 'Waiting for the machine to collect it.'
      : 'The machine is offline, so nothing has been delivered yet.';

  const students = (await Student.find({ _id: { $in: ids } }).select('studentId biometricId cardNumber userId').populate('userId', 'fullName').lean()) as any[];
  const results: PushResult[] = [];

  for (const s of students) {
    const base = { studentMongoId: String(s._id), studentId: s.studentId, name: s.userId?.fullName || '', biometricId: s.biometricId || '' };
    if (!s.biometricId) {
      results.push({ ...base, outcome: 'NOT_QUEUED', message: 'No E Number assigned' });
      continue;
    }

    // Never rename someone else: the machine already has this ID under a different name
    const onDevice = await BiometricDeviceUser.findOne({ deviceSerial: serial, pin: s.biometricId }).lean();
    const pushedBefore = await BiometricCommand.exists({ deviceSerial: serial, studentId: s._id, biometricId: s.biometricId, kind: 'USER_UPSERT', status: 'CONFIRMED' });
    if (onDevice && !pushedBefore && !options.force && !sameName((onDevice as any).name, base.name)) {
      results.push({
        ...base,
        outcome: 'NOT_QUEUED',
        message: `ID ${s.biometricId} is already on the machine as "${(onDevice as any).name}". Confirm it is the same person, then push with overwrite.`,
      });
      continue;
    }

    const commandText = buildUserCommand(s.biometricId, base.name, s.cardNumber);
    const dedupeKey = `${serial}|USER_UPSERT|${s._id}`;
    const live = await BiometricCommand.findOne({ dedupeKey, active: true });
    if (live) {
      if (live.text === commandText) {
        results.push({ ...base, outcome: live.status === 'SENT' ? 'AWAITING_DEVICE' : 'ALREADY_QUEUED', message: `Command ${live.commandId} is already ${live.status === 'SENT' ? 'with the machine, awaiting its reply' : 'queued'}; not duplicated.` });
        continue;
      }
      if (live.status === 'SENT') {
        results.push({ ...base, outcome: 'AWAITING_DEVICE', message: `Command ${live.commandId} with older details is awaiting the machine's reply. Push again once it finishes.` });
        continue;
      }
      // Still waiting to be collected: update it in place rather than adding a second command
      live.text = commandText;
      live.biometricId = s.biometricId;
      live.cardNumber = s.cardNumber || '';
      await live.save();
      results.push({ ...base, outcome: 'QUEUED', message: `Queued command ${live.commandId} updated with the latest details. ${waiting}` });
      continue;
    }

    try {
      const command = await BiometricCommand.create({
        deviceSerial: serial,
        commandId: await nextCommandId(),
        kind: 'USER_UPSERT',
        studentId: s._id,
        biometricId: s.biometricId,
        cardNumber: s.cardNumber || '',
        text: commandText,
        dedupeKey,
        active: true,
        requestedBy: actor?.userId,
      });
      results.push({ ...base, outcome: 'QUEUED', message: `Queued as command ${command.commandId}. ${waiting}` });
    } catch (err: any) {
      // A simultaneous push created the live command first
      if (!isDuplicateKey(err)) throw err;
      results.push({ ...base, outcome: 'ALREADY_QUEUED', message: 'Already queued by another request; not duplicated.' });
    }
  }

  const found = new Set(students.map((s) => String(s._id)));
  ids.filter((id) => !found.has(id)).forEach((id) => results.push({ studentMongoId: id, studentId: '', name: '', biometricId: '', outcome: 'NOT_QUEUED', message: 'Student not found' }));

  const queued = results.filter((r) => r.outcome === 'QUEUED').length;
  await logSync('PUSH', 'INFO', `Push requested for ${results.length} student(s): ${queued} queued, ${results.length - queued} not queued or already in progress. ${waiting}`, {
    deviceSerial: serial,
    meta: { byUserId: actor?.userId, deviceOnline: online },
  });
  return { deviceSerial: serial, deviceOnline: online, deviceEverConnected: !!device, results };
};

/** Commands to hand to the machine on this poll, as ADMS "C:<id>:<command>" lines ('' = none). */
export const collectCommands = async (deviceSerial: string): Promise<string> => {
  const stale = new Date(Date.now() - RESEND_AFTER_MS);

  const abandoned = await BiometricCommand.find({ deviceSerial, status: 'SENT', attempts: { $gte: MAX_ATTEMPTS }, sentAt: { $lt: stale } });
  for (const c of abandoned) {
    await BiometricCommand.updateOne(
      { _id: c._id, status: 'SENT' },
      { $set: { status: 'FAILED', error: `The machine collected the command ${c.attempts} times but never replied`, completedAt: new Date() }, $unset: { active: 1 } }
    );
    await logSync('COMMAND', 'ERROR', `Command ${c.commandId} (ID ${c.biometricId}) failed: no reply from the machine after ${c.attempts} attempts`, { deviceSerial });
  }

  const due = await BiometricCommand.find({
    deviceSerial,
    active: true,
    $or: [{ status: 'QUEUED' }, { status: 'SENT', sentAt: { $lt: stale }, attempts: { $lt: MAX_ATTEMPTS } }],
  })
    .sort({ commandId: 1 })
    .limit(COMMANDS_PER_POLL);
  if (!due.length) return '';

  await BiometricCommand.updateMany({ _id: { $in: due.map((c) => c._id) } }, { $set: { status: 'SENT', sentAt: new Date() }, $inc: { attempts: 1 } });
  return due.map((c) => `C:${c.commandId}:${c.text}`).join('\n');
};

// After the machine accepts a user, ask it to send that user back so the stored card can be checked
const queueReadback = async (command: IBiometricCommand) => {
  try {
    await BiometricCommand.create({
      deviceSerial: command.deviceSerial,
      commandId: await nextCommandId(),
      kind: 'USER_QUERY',
      studentId: command.studentId,
      biometricId: command.biometricId,
      text: `DATA QUERY USERINFO PIN=${command.biometricId}`,
      dedupeKey: `${command.deviceSerial}|USER_QUERY|${command.biometricId}`,
      active: true,
    });
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
  }
};

/** The machine's replies to commands: "ID=<id>&Return=<code>&CMD=<...>", one per line. */
export const recordCommandResults = async (deviceSerial: string, body: string) => {
  let handled = 0;
  for (const line of body.split(/\r?\n/).filter((l) => l.trim())) {
    const params = new URLSearchParams(line.trim());
    const commandId = Number(params.get('ID'));
    const returnCode = Number(params.get('Return'));
    if (!Number.isInteger(commandId) || !params.has('Return') || Number.isNaN(returnCode)) continue;

    const ok = returnCode === 0;
    // Only a live command changes state, so a repeated reply does nothing
    const command = await BiometricCommand.findOneAndUpdate(
      { deviceSerial, commandId, active: true },
      {
        $set: { status: ok ? 'CONFIRMED' : 'FAILED', returnCode, completedAt: new Date(), error: ok ? '' : `The machine rejected the command (Return=${returnCode})` },
        $unset: { active: 1 },
      },
      { new: true }
    );
    if (!command) continue;
    handled += 1;

    if (command.kind === 'USER_UPSERT') {
      await logSync(
        'COMMAND',
        ok ? 'INFO' : 'ERROR',
        ok ? `Machine accepted ID ${command.biometricId} (command ${commandId})` : `Machine rejected ID ${command.biometricId} (command ${commandId}, Return=${returnCode})`,
        { deviceSerial, meta: { commandId, returnCode, text: command.text } }
      );
      if (ok) await queueReadback(command);
    } else if (!ok) {
      await logSync('COMMAND', 'WARN', `Machine did not return the user record for ID ${command.biometricId} (command ${commandId}, Return=${returnCode})`, { deviceSerial });
    }
  }
  return handled;
};

/**
 * User records the machine uploads ("USER PIN=..\tName=..\tCard=.." lines, in OPERLOG or USERINFO
 * uploads). This is the machine's own statement of which card sits under which ID.
 */
export const recordDeviceUsers = async (deviceSerial: string, body: string, requirePrefix: boolean) => {
  const pins: string[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    const hasPrefix = /^USER\s+/i.test(line);
    if (!line || (requirePrefix && !hasPrefix)) continue;
    const fields = new Map<string, string>();
    line
      .replace(/^USER\s+/i, '')
      .split('\t')
      .forEach((part) => {
        const eq = part.indexOf('=');
        if (eq > 0) fields.set(part.slice(0, eq).trim().toLowerCase(), part.slice(eq + 1).trim());
      });
    const pin = fields.get('pin');
    if (!pin) continue;
    await BiometricDeviceUser.updateOne(
      { deviceSerial, pin },
      { $set: { name: fields.get('name') || '', card: fields.get('card') || '', privilege: fields.get('pri') || '', rawLine: line.slice(0, 500), reportedAt: new Date() } },
      { upsert: true }
    );
    pins.push(pin);
  }
  if (pins.length) {
    await rematchPunches(pins);
    await logSync('USERS', 'INFO', `Machine reported ${pins.length} user record(s): ID ${pins.slice(0, 20).join(', ')}${pins.length > 20 ? '…' : ''}`, { deviceSerial });
  }
  return pins.length;
};

// ---------------------------------------------------------------------------
// Overview, review queue and logs
// ---------------------------------------------------------------------------

// What is actually known about a student on the machine
export type DeviceUserStatus =
  | 'NO_E_NUMBER'
  | 'NOT_PUSHED'
  | 'QUEUED' // waiting for the machine to collect the command
  | 'SENT' // collected, no reply yet
  | 'FAILED' // the machine rejected it or never replied
  | 'CONFIRMED' // the machine replied OK; it has not sent the record back yet
  | 'VERIFIED' // the machine's own record shows this ID (and this card, when the student has one)
  | 'CARD_MISMATCH'; // the machine's record for this ID has a different card, or none

const deviceStatusFor = (student: any, command: any, deviceUser: any): { status: DeviceUserStatus; message: string } => {
  if (!student.biometricId) return { status: 'NO_E_NUMBER', message: 'No E Number assigned' };
  const cmd = command && command.biometricId === student.biometricId ? command : null;
  if (cmd?.status === 'QUEUED') return { status: 'QUEUED', message: `Command ${cmd.commandId} is waiting for the machine to collect it` };
  if (cmd?.status === 'SENT') return { status: 'SENT', message: `Command ${cmd.commandId} was collected by the machine (attempt ${cmd.attempts}); no reply yet` };

  // A record the machine sent back before the latest push says nothing about that push
  const fresh = deviceUser && (!cmd?.completedAt || new Date(deviceUser.reportedAt) >= new Date(cmd.completedAt));
  if (deviceUser && (fresh || cmd?.status !== 'CONFIRMED')) {
    const cards = deviceCardCandidates(deviceUser.card);
    if (student.cardNumber && !cards.includes(student.cardNumber)) {
      return {
        status: 'CARD_MISMATCH',
        message: cards.length ? `Machine has card ${deviceUser.card} under this ID; ScholarLogic has ${student.cardNumber}` : `Machine has no card under this ID; ScholarLogic has ${student.cardNumber}`,
      };
    }
    return { status: 'VERIFIED', message: `Machine reports ID ${deviceUser.pin} as "${deviceUser.name}"${student.cardNumber ? ` with card ${deviceUser.card}` : ''}` };
  }
  if (cmd?.status === 'FAILED') return { status: 'FAILED', message: cmd.error || 'The push failed' };
  if (cmd?.status === 'CONFIRMED') return { status: 'CONFIRMED', message: `Machine accepted command ${cmd.commandId}; waiting for it to send the stored record back` };
  return { status: 'NOT_PUSHED', message: 'Not pushed to the machine' };
};

const outOfWindowFilter = () => ({ $or: [{ localTime: { $lt: `${env.BIOMETRIC_SHIFT_START}:00` } }, { localTime: { $gt: `${env.BIOMETRIC_SHIFT_END}:59` } }] });

export const getOverview = async () => {
  const [{ serial, device, online }, settings, students, devices, counter, unknownIds, conflictIds, outOfWindow] = await Promise.all([
    targetDevice(),
    getSettings(),
    Student.find().select('studentId biometricId cardNumber essl userId accountStatus enrollment.mode createdAt').populate('userId', 'fullName').lean() as Promise<any[]>,
    BiometricDevice.find().sort({ lastSeenAt: -1 }).lean() as Promise<any[]>,
    Counter.findOne({ name: E_NUMBER_COUNTER }).lean(),
    BiometricPunch.distinct('userPin', { studentId: { $exists: false }, reviewReason: { $ne: 'ID_CONFLICT' } }),
    BiometricPunch.distinct('userPin', { studentId: { $exists: false }, reviewReason: 'ID_CONFLICT' }),
    BiometricPunch.countDocuments(outOfWindowFilter()),
  ]);

  const [commands, deviceUsers, pendingByDevice] = await Promise.all([
    serial ? BiometricCommand.find({ deviceSerial: serial, kind: 'USER_UPSERT' }).sort({ commandId: 1 }).lean() : [],
    serial ? BiometricDeviceUser.find({ deviceSerial: serial }).lean() : [],
    BiometricCommand.aggregate([{ $match: { active: true } }, { $group: { _id: '$deviceSerial', n: { $sum: 1 } } }]),
  ]);
  // Later commands overwrite earlier ones: the map ends up holding each student's latest
  const latestCommand = new Map((commands as any[]).map((c) => [String(c.studentId), c]));
  const deviceUserByPin = new Map((deviceUsers as any[]).map((u) => [u.pin, u]));
  const pending = new Map(pendingByDevice.map((p: any) => [p._id, p.n]));

  const rows = students
    .map((s) => {
      const deviceUser = s.biometricId ? deviceUserByPin.get(s.biometricId) : null;
      const command = latestCommand.get(String(s._id));
      return {
        _id: String(s._id),
        name: s.userId?.fullName || '—',
        studentId: s.studentId,
        biometricId: s.biometricId || '',
        cardNumber: s.cardNumber || '',
        mode: s.enrollment?.mode || 'OFFLINE',
        accountStatus: s.accountStatus,
        essl: {
          company: s.essl?.company || '',
          department: s.essl?.department || '',
          designation: s.essl?.designation || '',
          applyType: s.essl?.applyType || '',
        },
        device: {
          ...deviceStatusFor(s, command, deviceUser),
          commandId: command?.commandId ?? null,
          updatedAt: command?.updatedAt ?? deviceUser?.reportedAt ?? null,
        },
      };
    })
    .sort((a, b) => (a.biometricId || '~').localeCompare(b.biometricId || '~', undefined, { numeric: true }) || a.name.localeCompare(b.name));

  const withENumber = rows.filter((r) => r.biometricId);
  const missing = (k: 'company' | 'department' | 'designation' | 'applyType') => withENumber.filter((r) => !r.essl[k] && !settings.defaults[k]).length;

  return {
    integration: {
      method: 'ADMS push (the machine calls ScholarLogic at /iclock)',
      userCommand: env.BIOMETRIC_USER_COMMAND,
      allowedSerials: env.BIOMETRIC_DEVICE_SERIALS,
      targetSerial: serial,
      timezone: 'Asia/Kolkata',
      window: { start: env.BIOMETRIC_SHIFT_START, end: env.BIOMETRIC_SHIFT_END },
    },
    devices: devices.map((d) => ({
      serialNumber: d.serialNumber,
      online: Date.now() - new Date(d.lastSeenAt).getTime() < DEVICE_ONLINE_WINDOW_MS,
      lastSeenAt: d.lastSeenAt,
      lastIp: d.lastIp,
      lastPunchAt: d.lastPunchAt || null,
      lastSyncAt: d.lastSyncAt || null,
      lastSyncReceived: d.lastSyncReceived || 0,
      lastSyncInserted: d.lastSyncInserted || 0,
      lastErrorAt: d.lastErrorAt || null,
      lastError: d.lastError || '',
      totalPunches: d.totalPunches,
      pushVersion: d.pushVersion || '',
      deviceInfo: d.deviceInfo || '',
      pendingCommands: pending.get(d.serialNumber) || 0,
    })),
    targetDevice: { serial, everConnected: !!device, online },
    nextENumber: Math.max((counter as any)?.seq || 0, env.BIOMETRIC_ENUMBER_START - 1, await highestAssignedENumber()) + 1,
    counts: {
      students: rows.length,
      withENumber: withENumber.length,
      withoutENumber: rows.length - withENumber.length,
      withCard: rows.filter((r) => r.cardNumber).length,
      verifiedOnDevice: rows.filter((r) => r.device.status === 'VERIFIED').length,
      unknownIds: unknownIds.length,
      conflictIds: conflictIds.length,
      outOfWindowPunches: outOfWindow,
    },
    settings: {
      defaults: settings.defaults,
      applyTypeAllowed: settings.applyTypeAllowed,
      templateHeaders: settings.templateHeaders,
    },
    exportReadiness: {
      students: withENumber.length,
      blank: { company: missing('company'), department: missing('department'), designation: missing('designation'), applyType: missing('applyType') },
      layout: settings.templateHeaders.filter(Boolean).length ? 'Header row of the last imported eSSL file' : 'Six master columns (no eSSL file imported yet)',
    },
    students: rows,
  };
};

/** Punches that were not turned into attendance on their own: unknown or conflicting IDs, and punches outside the window. */
export const getReviewQueue = async () => {
  const [unlinked, outside] = await Promise.all([
    BiometricPunch.aggregate([
      { $match: { studentId: { $exists: false } } },
      { $sort: { punchTime: 1 } },
      {
        $group: {
          _id: '$userPin',
          punches: { $sum: 1 },
          firstPunchAt: { $min: '$punchTime' },
          lastPunchAt: { $max: '$punchTime' },
          lastLocalDate: { $last: '$localDate' },
          lastLocalTime: { $last: '$localTime' },
          reason: { $max: '$reviewReason' },
          note: { $max: '$reviewNote' },
          devices: { $addToSet: '$deviceSerial' },
        },
      },
      { $sort: { lastPunchAt: -1 } },
      { $limit: 500 },
    ]),
    BiometricPunch.find(outOfWindowFilter())
      .sort({ punchTime: -1 })
      .limit(300)
      .select('userPin localDate localTime direction deviceSerial studentId')
      .populate({ path: 'studentId', select: 'studentId userId', populate: { path: 'userId', select: 'fullName' } })
      .lean() as Promise<any[]>,
  ]);

  // Names come from the machine's own user list; suggestions only ever point at students without a code
  const [deviceUsers, linkedIds, unlinkedStudents] = await Promise.all([
    BiometricDeviceUser.find({}).select('pin name privilege').lean(),
    Student.distinct('biometricId', { biometricId: { $exists: true, $ne: '' } }),
    Student.find({ $or: [{ biometricId: { $exists: false } }, { biometricId: '' }] })
      .select('studentId userId')
      .populate('userId', 'fullName')
      .lean() as Promise<any[]>,
  ]);
  const machineUser = new Map(deviceUsers.map((u: any) => [u.pin, u]));
  const linked = new Set(linkedIds.map(String));
  const nameKey = (s: string) => (s || '').toLowerCase().replace(/[^a-z]/g, '');
  const candidates = unlinkedStudents
    .map((s) => ({ _id: String(s._id), studentId: s.studentId, fullName: s.userId?.fullName || '' }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
  const suggest = (machineName: string) => {
    const key = nameKey(machineName);
    if (!key) return null;
    const hits = candidates.filter((c) => nameKey(c.fullName) === key);
    return hits.length === 1 ? hits[0] : null; // two students with the same name: the admin picks
  };

  const entry = (u: any) => {
    const mu: any = machineUser.get(u._id);
    const isMachineAdmin = Number(mu?.privilege || 0) > 0;
    return {
      userPin: u._id,
      machineName: mu?.name || '',
      isMachineAdmin,
      suggestion: isMachineAdmin ? null : suggest(mu?.name || ''),
      punches: u.punches,
      firstPunchAt: u.firstPunchAt,
      lastPunchAt: u.lastPunchAt,
      lastLocal: u.lastLocalDate ? `${u.lastLocalDate} ${u.lastLocalTime}` : '',
      note: u.note || '',
      devices: u.devices,
    };
  };
  // Codes enrolled on the machine that haven't punched yet still need linking
  const seen = new Set(unlinked.map((u) => u._id));
  const notPunchedYet = deviceUsers
    .filter((u: any) => !linked.has(u.pin) && !seen.has(u.pin))
    .map((u: any) => ({ _id: u.pin, punches: 0, devices: [] }));
  const unknown = [...unlinked.filter((u) => u.reason !== 'ID_CONFLICT'), ...notPunchedYet].map(entry);
  // Suggested matches first, machine admins last
  unknown.sort((a, b) => Number(!!b.suggestion) - Number(!!a.suggestion) || Number(a.isMachineAdmin) - Number(b.isMachineAdmin));
  return {
    window: { start: env.BIOMETRIC_SHIFT_START, end: env.BIOMETRIC_SHIFT_END },
    candidates,
    unknownIds: unknown,
    conflicts: unlinked.filter((u) => u.reason === 'ID_CONFLICT').map(entry),
    outOfWindow: outside.map((p) => ({
      _id: String(p._id),
      userPin: p.userPin,
      date: p.localDate,
      time: p.localTime,
      direction: p.direction,
      deviceSerial: p.deviceSerial,
      studentId: p.studentId?.studentId || null,
      name: p.studentId?.userId?.fullName || null,
    })),
  };
};

export const getSyncLogs = async (query: { level?: string; limit?: string }) => {
  const filter: any = {};
  if (query.level && ['INFO', 'WARN', 'ERROR'].includes(query.level)) filter.level = query.level;
  const limit = Math.min(500, Math.max(1, Number(query.limit) || 200));
  const logs = await BiometricSyncLog.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
  return (logs as any[]).map((l) => ({ _id: String(l._id), at: l.createdAt, kind: l.kind, level: l.level, message: l.message, deviceSerial: l.deviceSerial }));
};
