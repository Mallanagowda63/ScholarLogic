/**
 * ScholarLogic <- ID card Google Form (the "Student info" form, or the new-student ID card form)
 *
 * Paste into the form's RESPONSE SPREADSHEET: Extensions -> Apps Script.
 * Deploy -> New deployment -> Web app, Execute as "Me", Who has access "Anyone" -> copy the /exec link.
 * (Updating: Deploy -> Manage deployments -> pencil -> Version: New version -> Deploy; the link stays.)
 *
 * ScholarLogic reads the answers from that link every 5 minutes (IDCARD_FORM_SYNC_URL / NEWID_FORM_SYNC_URL
 * + the secret below, in backend .env). It also asks for the photo a student attached, so the admin can
 * see it and it becomes the student's profile photo. This script only reads; it changes nothing.
 */

var SECRET = 'PASTE_THE_IDCARD_FORM_SECRET_HERE';

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
  var rows = allRows_(sheet);
  return json_({ success: true, formTitle: sheet.getParent().getName(), count: rows.length, responses: rows });
}

/** Opening the link in a browser just says it is running (answers are only given to ScholarLogic) */
function doGet() {
  return json_({ success: true, message: 'ScholarLogic ID card form link is running. Answers are only given to ScholarLogic.' });
}

/** Every response row as question/answer pairs, read in one go */
function allRows_(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];
  var range = sheet.getRange(1, 1, lastRow, lastCol);
  var values = range.getValues();
  var shown = range.getDisplayValues();
  var headers = values[0];
  var ss = sheet.getParent();
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var answers = [];
    var submittedAt = null;
    var empty = true;
    for (var c = 0; c < headers.length; c++) {
      var question = String(headers[c] || '').trim();
      if (!question) continue;
      if (/^timestamp$/i.test(question)) {
        var v = values[r][c];
        submittedAt = v instanceof Date ? v : v ? new Date(v) : null;
        continue;
      }
      if (String(shown[r][c]).trim()) empty = false;
      answers.push({ question: question, answer: String(shown[r][c] == null ? '' : shown[r][c]) });
    }
    if (empty) continue;
    var hasTime = submittedAt && !isNaN(submittedAt.getTime());
    out.push({
      // Same id for the same answer every time (a row typed in by hand, with no Timestamp, uses 0)
      submissionId: ss.getId() + ':' + sheet.getSheetId() + ':' + (r + 1) + ':' + (hasTime ? submittedAt.getTime() : 0),
      submittedAt: (hasTime ? submittedAt : new Date()).toISOString(),
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

/** Run this once from the editor (choose "checkSetup", press Run): asks for permission and shows what it sees */
function checkSetup() {
  var sheet = responseSheet_();
  console.log('Spreadsheet: "' + sheet.getParent().getName() + '", tab "' + sheet.getName() + '" with ' + Math.max(0, sheet.getLastRow() - 1) + ' answer(s)');
  console.log('Columns: ' + sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].join(' | '));
  DriveApp.getRootFolder(); // makes Google ask for Drive permission now (needed for the photos)
  console.log('OK. Now Deploy -> Manage deployments -> pencil -> Version: New version -> Deploy.');
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
