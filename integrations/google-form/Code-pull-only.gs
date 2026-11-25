/**
 * ScholarLogic <- Student registration Google Form (forms.gle/AvVhu6U2erHPdJc17)
 *
 * Paste into the form's RESPONSE SPREADSHEET: Extensions -> Apps Script.
 * Deploy -> New deployment -> Web app, Execute as "Me", Who has access "Anyone" -> copy the /exec link
 * and put it in GOOGLE_FORM_SYNC_URL (backend .env). SECRET below = GOOGLE_FORM_WEBHOOK_SECRET.
 *
 * ScholarLogic reads the answers from that link every few minutes and shows each one under
 * Admin -> Registrations (Pending verification). It also asks for the photo a student attached,
 * so the admin can see it and it becomes the student's profile photo. This script only reads.
 */

var SECRET = 'PASTE_THE_GOOGLE_FORM_WEBHOOK_SECRET_HERE';

/** ScholarLogic POSTs {"secret": "..."} for the answers, or {"secret": "...", "photoId": "..."} for one photo */
function doPost(e) {
  var body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    body = {};
  }
  if (!body.secret) return json_({ success: false, message: 'Secret missing' });
  if (String(body.secret).trim() !== SECRET) return json_({ success: false, message: 'Invalid secret' });
  var sheet = responseSheet_();
  if (body.photoId) return photo_(sheet, body.photoId);
  // Optional "since" (ISO date): only answers submitted from then on (keeps old answers out)
  var since = body.since ? new Date(body.since) : null;
  if (since && isNaN(since.getTime())) since = null;
  var rows = allRows_(sheet, since);
  return json_({ success: true, formTitle: sheet.getParent().getName(), count: rows.length, responses: rows });
}

/** Opening the link in a browser just says it is running (answers are only given to ScholarLogic) */
function doGet() {
  return json_({ success: true, message: 'ScholarLogic registration form link is running.' });
}

/** Every response row as question/answer pairs, read in one go (fast even with thousands of rows) */
function allRows_(sheet, since) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];
  var range = sheet.getRange(1, 1, lastRow, lastCol);
  var values = range.getValues();
  var shown = range.getDisplayValues();
  var headers = values[0];
  var ss = sheet.getParent();
  var tz = ss.getSpreadsheetTimeZone();
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var answers = [];
    var submittedAt = null;
    var empty = true;
    for (var c = 0; c < headers.length; c++) {
      var question = String(headers[c] || '').trim();
      if (!question) continue;
      var value = values[r][c];
      if (/^timestamp$/i.test(question)) {
        submittedAt = value instanceof Date ? value : new Date(value);
        continue;
      }
      if (String(shown[r][c]).trim()) empty = false;
      // Dates (DOB, joining date) as yyyy-MM-dd; time answers are sent as shown in the sheet
      var isTimeOnly = value instanceof Date && value.getFullYear() < 1901;
      var answer = value instanceof Date && !isTimeOnly && !/tim/i.test(question) ? Utilities.formatDate(value, tz, 'yyyy-MM-dd') : shown[r][c];
      answers.push({ question: question, answer: String(answer == null ? '' : answer) });
    }
    if (empty) continue;
    var hasTime = submittedAt && !isNaN(submittedAt.getTime());
    if (!hasTime) submittedAt = new Date();
    if (since && submittedAt < since) continue;
    out.push({
      // Same id for the same response every time, so ScholarLogic never adds it twice (no Timestamp: 0)
      submissionId: ss.getId() + ':' + sheet.getSheetId() + ':' + (r + 1) + ':' + (hasTime ? submittedAt.getTime() : 0),
      submittedAt: submittedAt.toISOString(),
      source: 'GOOGLE_FORM',
      formTitle: ss.getName(),
      answers: answers,
    });
  }
  return out;
}

/**
 * One photo a student attached (it is private in your Drive). Only a file whose link is in
 * this form's answers is given, so nothing else in your Drive can be read.
 */
function photo_(sheet, photoId) {
  var id = String(photoId || '').trim();
  if (!/^[\w-]{20,}$/.test(id)) return json_({ success: false, message: 'Bad photo id' });
  if (!sheet.createTextFinder(id).findNext()) return json_({ success: false, message: 'This photo is not in the form answers' });
  var blob = null;
  try {
    // A smaller copy (800 px wide) keeps the database light
    var r = UrlFetchApp.fetch('https://drive.google.com/thumbnail?id=' + id + '&sz=w800', {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true,
    });
    if (r.getResponseCode() === 200 && /^image\//.test(r.getBlob().getContentType())) blob = r.getBlob();
  } catch (err) {
    blob = null;
  }
  if (!blob) {
    var file = DriveApp.getFileById(id);
    // A photo: the file itself. A PDF or document: Google's preview picture of its first page.
    blob = /^image\//.test(file.getMimeType()) ? file.getBlob() : file.getThumbnail();
    if (!blob) return json_({ success: false, message: 'Not a photo and no preview (' + file.getMimeType() + ')' });
  }
  return json_({ success: true, mimeType: blob.getContentType() || 'image/png', base64: Utilities.base64Encode(blob.getBytes()) });
}

/** Run this once from the editor (select "checkSetup" and press Run): asks for permission and shows what it sees */
function checkSetup() {
  var sheet = responseSheet_();
  console.log('Response tab: "' + sheet.getName() + '" with ' + Math.max(0, sheet.getLastRow() - 1) + ' answer(s)');
  console.log('Columns: ' + sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].join(' | '));
  DriveApp.getRootFolder(); // makes Google ask for Drive permission now (needed for the photos)
  console.log('OK. Now Deploy -> New deployment -> Web app (Execute as: Me, Who has access: Anyone).');
}

/** The tab the form writes into (first one linked to a form, otherwise the first tab) */
function responseSheet_() {
  var sheets = SpreadsheetApp.getActive().getSheets();
  for (var i = 0; i < sheets.length; i++) if (sheets[i].getFormUrl()) return sheets[i];
  return sheets[0];
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
