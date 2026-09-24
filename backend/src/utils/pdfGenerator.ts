export function generateCertificatePDFBuffer(
  studentName: string,
  courseTitle: string,
  certificateId: string,
  issueDate: Date
): Buffer {
  const formattedDate = new Date(issueDate).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const pdfContent = [
    '%PDF-1.4',
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents 4 0 R >> endobj',
    '4 0 obj << /Length 260 >> stream',
    'BT',
    '/F1 24 Tf 200 500 TD (SCHOLARLOGIC CERTIFICATE OF COMPLETION) Tj',
    '/F1 16 Tf -50 -50 TD (This certifies that ' + studentName + ') Tj',
    '/F1 16 Tf 0 -30 TD (has successfully completed ' + courseTitle + ') Tj',
    '/F1 12 Tf 0 -40 TD (Issued Date: ' + formattedDate + ' | Certificate ID: ' + certificateId + ') Tj',
    '/F1 10 Tf 0 -30 TD (Verified by ScholarLogic Platform Verification Service) Tj',
    'ET',
    'endstream endobj',
    'xref',
    '0 5',
    '0000000000 65535 f',
    '0000000009 00000 n',
    '0000000058 00000 n',
    '0000000115 00000 n',
    '0000000216 00000 n',
    'trailer << /Size 5 /Root 1 0 R >>',
    'startxref 500 %%EOF',
  ].join('\n');

  return Buffer.from(pdfContent);
}
