// Pure domain logic for parsing rosters and building random teams.
// No React, no DOM (except the small CSV download helper) — easy to reason about and test.

export interface Person {
  name: string;
  email: string;
  status: string;
  checkedIn: boolean;
}

// How to handle people left over when the count isn't a multiple of team size.
export type Remainder = 'separate' | 'distribute';

const NAME_HEADERS = ['name', 'full name', 'fullname', 'имя', 'фио', 'участник', 'participant'];
const FIRST_HEADERS = ['first_name', 'first name', 'firstname', 'имя'];
const LAST_HEADERS = ['last_name', 'last name', 'lastname', 'фамилия'];
const EMAIL_HEADERS = ['email', 'e-mail', 'почта'];
const STATUS_HEADERS = ['approval_status', 'status', 'статус'];
const CHECKIN_HEADERS = ['checked_in_at', 'checked in', 'checkin', 'check_in', 'check-in'];

// RFC4180-ish CSV parser: handles quoted fields, embedded commas/newlines and "" escapes.
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

const findCol = (headers: string[], candidates: string[]) =>
  headers.findIndex((h) => candidates.includes(h.trim().toLowerCase()));

// Turn raw CSV text into a list of people, auto-detecting the relevant columns.
export function parsePeople(text: string): Person[] {
  const rows = parseCSV(text);
  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim());
  const looksLikeHeader =
    findCol(headers, NAME_HEADERS) !== -1 ||
    findCol(headers, FIRST_HEADERS) !== -1 ||
    headers.some((h) => h.toLowerCase() === 'guest_id');

  let nameIdx = findCol(headers, NAME_HEADERS);
  const firstIdx = findCol(headers, FIRST_HEADERS);
  const lastIdx = findCol(headers, LAST_HEADERS);
  const emailIdx = findCol(headers, EMAIL_HEADERS);
  const statusIdx = findCol(headers, STATUS_HEADERS);
  const checkinIdx = findCol(headers, CHECKIN_HEADERS);

  const dataRows = looksLikeHeader ? rows.slice(1) : rows;
  // No header: just take the first column as the name.
  if (!looksLikeHeader) nameIdx = 0;

  const people: Person[] = [];
  for (const r of dataRows) {
    const direct = nameIdx !== -1 ? (r[nameIdx] || '').trim() : '';
    const composed = [r[firstIdx] || '', r[lastIdx] || ''].join(' ').trim();
    const name = direct || composed;
    if (!name) continue;
    people.push({
      name,
      email: (emailIdx !== -1 ? r[emailIdx] || '' : '').trim().toLowerCase(),
      status: (statusIdx !== -1 ? r[statusIdx] || '' : '').trim().toLowerCase(),
      checkedIn: checkinIdx !== -1 && (r[checkinIdx] || '').trim() !== '',
    });
  }
  return people;
}

// Count people per approval status; people without a status fall under '(no status)'.
export function countStatuses(roster: Person[]): Record<string, number> {
  return roster.reduce<Record<string, number>>((acc, p) => {
    const key = p.status || '(no status)';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

export interface FilterOptions {
  statusFilter: string[];
  hasStatuses: boolean;
  checkedInOnly: boolean;
  dedupe: boolean;
}

// Apply status filter -> checked-in filter -> dedupe, in that order.
export function filterPeople(roster: Person[], opts: FilterOptions): Person[] {
  let list = opts.hasStatuses
    ? roster.filter((p) => opts.statusFilter.includes(p.status))
    : roster.slice();
  if (opts.checkedInOnly) {
    list = list.filter((p) => p.checkedIn);
  }
  if (opts.dedupe) {
    const seen = new Set<string>();
    list = list.filter((p) => {
      const key = p.email || p.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  return list;
}

// Fisher–Yates shuffle (returns a new array).
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Plan the team sizes for `n` people given a target size and remainder strategy.
// 'separate'   -> teams of `size`, leftovers form one smaller team.
// 'distribute' -> fewer teams (floor(n/size)), leftovers spread in -> some bigger teams.
export function planSizes(n: number, size: number, mode: Remainder): number[] {
  if (n <= 0 || size <= 0) return [];
  if (mode === 'separate') {
    const sizes: number[] = [];
    for (let left = n; left > 0; left -= size) sizes.push(Math.min(size, left));
    return sizes;
  }
  const count = Math.max(1, Math.floor(n / size));
  const base = Math.floor(n / count);
  const extra = n % count; // first `extra` teams get one more member
  return Array.from({ length: count }, (_, t) => base + (t < extra ? 1 : 0));
}

// Human-readable summary of a list of team sizes, e.g. "24 teams of 3 · 1 team of 4".
export function describePlan(sizes: number[]): string {
  const byCount = sizes.reduce<Record<number, number>>((acc, s) => {
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(byCount)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([s, c]) => `${c} ${c === 1 ? 'team' : 'teams'} of ${s}`)
    .join(' · ');
}

// Two-letter initials for an avatar chip (handles single-word names too).
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const chars = parts.slice(0, 2).map((p) => p[0] || '');
  return (chars.join('') || name.trim()[0] || '?').toUpperCase();
}

// Split people into teams using the chosen remainder strategy.
export function makeTeams(people: Person[], size: number, mode: Remainder): Person[][] {
  const shuffled = shuffle(people);
  const sizes = planSizes(shuffled.length, size, mode);
  const teams: Person[][] = [];
  let idx = 0;
  for (const s of sizes) {
    teams.push(shuffled.slice(idx, idx + s));
    idx += s;
  }
  return teams;
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

// Serialize teams to CSV text (Team,Name,Email), numbering from `startNumber`.
export function teamsToCSV(teams: Person[][], startNumber: number): string {
  const lines = ['Team,Name,Email'];
  teams.forEach((team, i) => {
    team.forEach((member) =>
      lines.push(`Team ${startNumber + i},${csvCell(member.name)},${csvCell(member.email)}`)
    );
  });
  return lines.join('\n');
}

// Trigger a client-side file download for the given text content.
export function downloadFile(filename: string, content: string, type = 'text/csv'): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
