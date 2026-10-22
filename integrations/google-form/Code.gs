/**
 * ScholarLogic ← Google Form intake
 *
 * Bound to the Google Form's RESPONSE SPREADSHEET (Extensions → Apps Script).
 * On every form submission it POSTs the answers to the ScholarLogic backend, which creates a
 * "New Registration" (Pending Verification) in the Admin Panel. Nothing is allocated automatically.
 *
 * Script Properties (Project Settings → Script Properties):
 *   SCHOLARLOGIC_API_URL      e.g. https://api.yourdomain.com/api/integrations/google-form/student
 *   SCHOLARLOGIC_FORM_SECRET  same value as GOOGLE_FORM_WEBHOOK_SECRET on the backend
 *
 * Setup once: run installTriggers() from the editor and approve the permissions.
 * Every delivery is recorded in the "ScholarLogic Sync" tab; run retryFailed() (or let the
 * 15-minute trigger do it) to resend anything that failed, e.g. while the backend was down.
 */

var SYNC_SHEET = 'ScholarLogic Sync';
var SYNC_HEADERS = ['Response row', 'Submission ID', 'Status', 'HTTP', 'Message', 'Last attempt', 'Attempts'];

/** Installable "On form submit" trigger handler (spreadsheet event) */
function onFormSubmitToScholarLogic(e) {
  var row = e && e.range ? e.range.getRow() : null;
  if (!row) {
    console.error('No event range — run installTriggers() instead of calling this function directly.');
    return;
  }
  deliverRow_(e.range.getSheet(), row);
}

/** Creates the form-submit trigger and a 15-minute retry trigger (safe to run again) */
function installTriggers() {
  var ss = SpreadsheetApp.getActive();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (fn === 'onFormSubmitToScholarLogic' || fn === 'retryFailed') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onFormSubmitToScholarLogic').forSpreadsheet(ss).onFormSubmit().create();
  ScriptApp.newTrigger('retryFailed').timeBased().everyMinutes(15).create();
  getSyncSheet_();
  console.log('Triggers installed for ' + ss.getName());
}

/** Resends every response whose latest delivery failed */
function retryFailed() {
  var responses = getResponseSheet_();
  var log = getSyncSheet_();
  var data = log.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][2] === 'FAILED') deliverRow_(responses, Number(data[i][0]));
  }
}

/**
 * Imports every response that hasn't been delivered yet — including ones submitted before this
 * script was installed. Safe to run any time: the backend ignores responses it already has.
 */
function syncAllResponses() {
  var responses = getResponseSheet_();
  var log = getSyncSheet_().getDataRange().getValues();
  var sent = {};
  for (var i = 1; i < log.length; i++) {
    if (log[i][2] === 'SENT' || log[i][2] === 'STORED_NEEDS_REVIEW') sent[Number(log[i][0])] = true;
  }
  var lastRow = responses.getLastRow();
  var pending = 0;
  for (var r = 2; r <= lastRow; r++) if (!sent[r]) pending++;
  console.log('Response sheet "' + responses.getName() + '": ' + Math.max(0, lastRow - 1) + ' response(s), ' + pending + ' to send');
  if (lastRow < 2) {
    console.log('No responses found. Submit the form once, or check that this script was opened from the response spreadsheet (Extensions → Apps Script).');
    return;
  }
  for (var row = 2; row <= lastRow; row++) {
    if (!sent[row]) deliverRow_(responses, row);
  }
}

/**
 * Diagnostics: checks the script properties and whether the backend accepts the secret.
 * Sends an empty list, which the backend rejects before saving anything.
 */
function checkSettings() {
  var props = PropertiesService.getScriptProperties();
  var url = String(props.getProperty('SCHOLARLOGIC_API_URL') || '').trim().replace(/^["']|["']$/g, '');
  var secret = String(props.getProperty('SCHOLARLOGIC_FORM_SECRET') || '').trim().replace(/^["']|["']$/g, '');
  console.log('Properties found: ' + props.getKeys().join(', '));
  console.log('URL: ' + (url || '(missing)'));
  console.log('Secret: ' + (secret ? secret.length + ' characters, starts "' + secret.slice(0, 3) + '", ends "' + secret.slice(-3) + '"' : '(missing)'));
  if (!url || !secret) return;
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-ScholarLogic-Secret': secret },
    payload: '[]',
    muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  console.log(code === 400 ? 'OK — backend accepted the secret (' + code + ')' : code === 401 ? 'Secret rejected (401) — re-paste SCHOLARLOGIC_FORM_SECRET' : 'Backend replied ' + code + ': ' + res.getContentText().slice(0, 150));
}

/** Sends every response row again (the backend skips ones it already has) — use after switching servers */
function resendAllResponses() {
  var responses = getResponseSheet_();
  var lastRow = responses.getLastRow();
  console.log('Resending ' + Math.max(0, lastRow - 1) + ' response(s) from "' + responses.getName() + '"');
  for (var row = 2; row <= lastRow; row++) deliverRow_(responses, row);
}

/** Manual test: sends the most recent response again (idempotent on the backend) */
function sendLatestResponse() {
  var responses = getResponseSheet_();
  deliverRow_(responses, responses.getLastRow());
}

// ---------------------------------------------------------------------------
// Pull mode: ScholarLogic fetches responses from this script (Deploy → Web app).
// Works without a public backend URL — ScholarLogic calls Google, not the other way round.
// ---------------------------------------------------------------------------

/** ScholarLogic POSTs {"secret": "..."} and receives every response row as JSON */
function doPost(e) {
  var body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    body = {};
  }
  return respondWithResponses_(body.secret);
}

/** Browser check: opening the web app URL without the secret just says it is running */
function doGet(e) {
  return respondWithResponses_(e && e.parameter ? e.parameter.secret : '');
}

function respondWithResponses_(givenSecret) {
  var expected = String(PropertiesService.getScriptProperties().getProperty('SCHOLARLOGIC_FORM_SECRET') || '').trim().replace(/^["']|["']$/g, '');
  if (!givenSecret) return json_({ success: true, message: 'ScholarLogic form sync is running. Responses are only returned to ScholarLogic.' });
  if (!expected || String(givenSecret).trim() !== expected) return json_({ success: false, message: 'Invalid secret' });

  var sheet = getResponseSheet_();
  var responses = [];
  for (var row = 2; row <= sheet.getLastRow(); row++) responses.push(buildPayload_(sheet, row));
  return json_({ success: true, formTitle: sheet.getParent().getName(), count: responses.length, responses: responses });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------

function deliverRow_(sheet, row) {
  var props = PropertiesService.getScriptProperties();
  // Trim and drop surrounding quotes: copy-paste often adds them
  var url = String(props.getProperty('SCHOLARLOGIC_API_URL') || '').trim().replace(/^["']|["']$/g, '');
  var secret = String(props.getProperty('SCHOLARLOGIC_FORM_SECRET') || '').trim().replace(/^["']|["']$/g, '');
  if (!url || !secret) {
    var missing = 'Missing script property: ' + (!url ? 'SCHOLARLOGIC_API_URL ' : '') + (!secret ? 'SCHOLARLOGIC_FORM_SECRET' : '');
    console.error('Row ' + row + ' → FAILED. ' + missing + ' (Project Settings → Script Properties)');
    recordSync_(row, '', 'FAILED', '', missing);
    return;
  }

  var payload = buildPayload_(sheet, row);
  var status = 'FAILED';
  var code = '';
  var message = '';
  try {
    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'X-ScholarLogic-Secret': secret },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      followRedirects: true,
    });
    code = res.getResponseCode();
    var body = {};
    try {
      body = JSON.parse(res.getContentText());
    } catch (parseError) {
      body = {};
    }
    if (code >= 200 && code < 300) {
      // 202 = stored on the backend but needs admin attention (visible under Failed submissions)
      status = body.data && body.data.status === 'FAILED' ? 'STORED_NEEDS_REVIEW' : 'SENT';
      message = (body.data && (body.data.note || body.data.error)) || 'OK';
    } else {
      message = (body && body.message) || res.getContentText().slice(0, 200);
    }
  } catch (err) {
    // Network error / backend down: the response stays in this sheet and is retried later
    message = String(err && err.message ? err.message : err).slice(0, 200);
  }
  recordSync_(row, payload.submissionId, status, code, message);
  console.log('Row ' + row + ' → ' + status + ' (' + code + ') ' + message);
}

/** Sends every question/answer in column order (the live form has two columns titled "Course") */
function buildPayload_(sheet, row) {
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var values = sheet.getRange(row, 1, 1, lastCol).getValues()[0];
  var display = sheet.getRange(row, 1, 1, lastCol).getDisplayValues()[0];

  var tz = sheet.getParent().getSpreadsheetTimeZone();
  var answers = [];
  var submittedAt = null;
  for (var c = 0; c < headers.length; c++) {
    var question = String(headers[c] || '').trim();
    if (!question) continue;
    var value = values[c];
    if (/^timestamp$/i.test(question)) {
      submittedAt = value instanceof Date ? value : new Date(value);
      continue;
    }
    // Dates as yyyy-MM-dd in the sheet's timezone (joining date). Time-picker answers are stored
    // as 30 Dec 1899 + time, so those (and any "time/timing" question) are sent as shown in the sheet.
    var isTimeOnly = value instanceof Date && value.getFullYear() < 1901;
    var answer = value instanceof Date && !isTimeOnly && !/tim/i.test(question) ? Utilities.formatDate(value, tz, 'yyyy-MM-dd') : display[c];
    answers.push({ question: question, answer: String(answer == null ? '' : answer) });
  }
  if (!submittedAt || isNaN(submittedAt.getTime())) submittedAt = new Date();

  var ss = sheet.getParent();
  return {
    // Stable per response so retries never create duplicates on the backend
    submissionId: ss.getId() + ':' + sheet.getSheetId() + ':' + row + ':' + submittedAt.getTime(),
    submittedAt: submittedAt.toISOString(),
    source: 'GOOGLE_FORM',
    formTitle: ss.getName(),
    answers: answers,
  };
}

function recordSync_(row, submissionId, status, code, message) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var log = getSyncSheet_();
    var data = log.getDataRange().getValues();
    var now = new Date();
    for (var i = 1; i < data.length; i++) {
      if (Number(data[i][0]) === row) {
        log.getRange(i + 1, 2, 1, 6).setValues([[submissionId || data[i][1], status, code, message, now, Number(data[i][6] || 0) + 1]]);
        return;
      }
    }
    log.appendRow([row, submissionId, status, code, message, now, 1]);
  } finally {
    lock.releaseLock();
  }
}

function getSyncSheet_() {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(SYNC_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(SYNC_SHEET);
    sheet.appendRow(SYNC_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** The sheet the form writes to (first sheet that isn't the sync log) */
function getResponseSheet_() {
  var sheets = SpreadsheetApp.getActive().getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName() !== SYNC_SHEET && sheets[i].getFormUrl()) return sheets[i];
  }
  return sheets[0];
}
