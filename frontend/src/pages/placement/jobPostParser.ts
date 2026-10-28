// Reads a job post pasted from WhatsApp, LinkedIn, an email or a careers page and picks out the basics.
// Anything it can't find is simply left empty for the placement team to type.

export interface ParsedJobPost {
  companyName: string;
  title: string;
  applyUrl: string;
  deadline: string; // yyyy-mm-dd
  location: string;
  salaryPackage: string;
  requiredSkills: string[];
  type: 'FULL_TIME' | 'INTERNSHIP';
}

const SEP = String.raw`\s*(?:[:\-–—=]|\bis\b)\s*`;
const labelled = (lines: string[], labels: string) => {
  const re = new RegExp(String.raw`^(?:${labels})${SEP}(.+)$`, 'i');
  for (const line of lines) {
    const m = line.match(re);
    if (m && m[1].trim()) return m[1].trim().replace(/[*_]+/g, '').trim();
  }
  return '';
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const parseDate = (raw: string) => {
  const text = raw.replace(/(\d+)(st|nd|rd|th)\b/gi, '$1').replace(/[(),]/g, ' ').trim();
  const dmy = text.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  let d: Date | null = null;
  if (dmy) {
    const y = Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]);
    d = new Date(y, Number(dmy[2]) - 1, Number(dmy[1]));
  } else {
    const named = text.match(/\b(\d{1,2}\s+[A-Za-z]{3,9}\.?\s*\d{4}|[A-Za-z]{3,9}\.?\s+\d{1,2}\s+\d{4})\b/);
    if (named) d = new Date(named[1].replace('.', ''));
  }
  if (!d || Number.isNaN(d.getTime()) || d.getFullYear() < 2024 || d.getFullYear() > 2100) return '';
  return iso(d);
};

const pickLink = (text: string) => {
  const urls = (text.match(/https?:\/\/[^\s<>"')\]]+/gi) || []).map((u) => u.replace(/[.,;:!]+$/, ''));
  const score = (u: string) =>
    /forms\.gle|docs\.google\.com\/forms|forms\.office|typeform|jotform/i.test(u) ? 3 : /apply|career|jobs?\b|job|recruit|hiring|lever\.co|greenhouse|workday|naukri|linkedin\.com\/jobs/i.test(u) ? 2 : 1;
  return urls.sort((a, b) => score(b) - score(a))[0] || '';
};

export function parseJobPost(text: string): ParsedJobPost {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[^\p{L}\p{N}]+/u, '').trim())
    .filter(Boolean);

  let companyName = labelled(lines, 'company name|company|organi[sz]ation|employer|hiring company');
  let title = labelled(lines, 'job title|job role|role|position|designation|title|profile|opening|post');
  const hiring = lines.map((l) => l.match(/^(.{2,60}?)\s+(?:is\s+)?hiring\b(?:\s+for)?(?:\s+an?)?\s*[:\-–]?\s*(.*)$/i)).find(Boolean);
  if (hiring) {
    if (!companyName && !/^we\b|^urgent/i.test(hiring[1])) companyName = hiring[1].replace(/[*_!]+/g, '').trim();
    if (!title && hiring[2]) title = hiring[2].replace(/[*_!]+/g, '').replace(/\s*[|,].*$/, '').trim();
  }
  if (!title && lines[0] && lines[0].length <= 70 && !/https?:/i.test(lines[0])) title = lines[0].replace(/[*_!]+/g, '').trim();

  const location = labelled(lines, 'job location|work location|location|place|city|venue');
  let salaryPackage = labelled(lines, 'salary|ctc|package|stipend|compensation|pay');
  if (!salaryPackage) salaryPackage = (text.match(/\d+(?:\.\d+)?\s*(?:-|to)\s*\d+(?:\.\d+)?\s*(?:LPA|lakhs?)|\d+(?:\.\d+)?\s*LPA/i) || [''])[0];

  const deadlineText = labelled(lines, 'last date to apply|last date|apply by|apply before|deadline|closing date|application deadline');
  const skills = labelled(lines, 'required skills|key skills|skills required|skills|tech stack|technologies');

  return {
    companyName,
    title: title.slice(0, 120),
    applyUrl: pickLink(text),
    deadline: deadlineText ? parseDate(deadlineText) : '',
    location: location.slice(0, 80),
    salaryPackage: salaryPackage.slice(0, 60),
    requiredSkills: skills ? skills.split(/[,/|•;]+/).map((s) => s.trim()).filter((s) => s && s.length <= 40).slice(0, 12) : [],
    type: /\bintern(ship)?\b/i.test(`${title} ${text.slice(0, 400)}`) ? 'INTERNSHIP' : 'FULL_TIME',
  };
}
