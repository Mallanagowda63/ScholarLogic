/**
 * ScholarLogic <- "Student info - ScholarLogic" Google Form (students type the ID on their card)
 *
 * Paste into the form's RESPONSE SPREADSHEET: Extensions -> Apps Script.
 * Deploy -> New deployment -> Web app, Execute as "Me", Who has access "Anyone" -> copy the /exec link.
 * ScholarLogic reads the answers from that link every 5 minutes (IDCARD_FORM_SYNC_URL + IDCARD_FORM_SECRET
 * in backend .env) and emails each matched student their login. This script only reads; it changes nothing.
 */

var SECRET = 'PASTE_THE_IDCARD_FORM_SECRET_HERE';

/** ScholarLogic POSTs {"secret": "..."} and receives every answer as JSON */
function doPost(e) {
  var body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    body = {};
  }
  return answer_(body.secret);
}

/** Opening the link in a browser just says it is running */
function doGet(e) {
  return answer_(e && e.parameter ? e.parameter.secret : '');
}

function answer_(given) {
  if (!given) return json_({ success: true, message: 'ScholarLogic ID card form link is running. Answers are only given to ScholarLogic.' });
  if (String(given).trim() !== SECRET) return json_({ success: false, message: 'Invalid secret' });
  var sheet = responseSheet_();
  var rows = [];
  for (var row = 2; row <= sheet.getLastRow(); row++) rows.push(rowPayload_(sheet, row));
  return json_({ success: true, formTitle: sheet.getParent().getName(), count: rows.length, responses: rows });
}

function rowPayload_(sheet, row) {
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var values = sheet.getRange(row, 1, 1, lastCol).getValues()[0];
  var shown = sheet.getRange(row, 1, 1, lastCol).getDisplayValues()[0];
  var answers = [];
  var submittedAt = null;
  for (var c = 0; c < headers.length; c++) {
    var question = String(headers[c] || '').trim();
    if (!question) continue;
    if (/^timestamp$/i.test(question)) {
      submittedAt = values[c] instanceof Date ? values[c] : new Date(values[c]);
      continue;
    }
    answers.push({ question: question, answer: String(shown[c] == null ? '' : shown[c]) });
  }
  if (!submittedAt || isNaN(submittedAt.getTime())) submittedAt = new Date();
  var ss = sheet.getParent();
  return {
    submissionId: ss.getId() + ':' + sheet.getSheetId() + ':' + row + ':' + submittedAt.getTime(),
    submittedAt: submittedAt.toISOString(),
    formTitle: ss.getName(),
    answers: answers,
  };
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
