import { useState, useRef } from 'react';
import type { ChangeEvent } from 'react';
import './HackathonTimer.css';
import cursorLogo from './assets/cursor_logo.svg';

const DEFAULT_LOGOS = [cursorLogo];

type Phase = 'setup' | 'results';

interface Person {
  name: string;
  email: string;
  status: string;
  checkedIn: boolean;
}

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

// Turn raw CSV text into a list of people (name + status), picking the right columns.
function parsePeople(text: string): Person[] {
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

// Fisher–Yates shuffle (returns a new array).
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// How to handle people left over when the count isn't a multiple of team size.
type Remainder = 'separate' | 'distribute';

// Plan the team sizes for `n` people given a target size and remainder strategy.
// 'separate'   -> teams of `size`, leftovers form one smaller team.
// 'distribute' -> fewer teams (floor(n/size)), leftovers spread in -> some bigger teams.
function planSizes(n: number, size: number, mode: Remainder): number[] {
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
function describePlan(sizes: number[]): string {
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
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const chars = parts.slice(0, 2).map((p) => p[0] || '');
  return (chars.join('') || name.trim()[0] || '?').toUpperCase();
}

// Split people into teams using the chosen remainder strategy.
function makeTeams(people: Person[], size: number, mode: Remainder): Person[][] {
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

export default function HackathonTimer() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [description, setDescription] = useState('');
  const [logos, setLogos] = useState<string[]>(DEFAULT_LOGOS);

  // team generator
  const [roster, setRoster] = useState<Person[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [dedupe, setDedupe] = useState(true);
  const [checkedInOnly, setCheckedInOnly] = useState(true);
  const [teams, setTeams] = useState<Person[][]>([]);
  const [query, setQuery] = useState('');
  const [teamSize, setTeamSize] = useState(3);
  const [remainder, setRemainder] = useState<Remainder>('separate');
  const startNumber = 1;
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const removeLogo = (index: number) => {
    setLogos(logos.filter((_, i) => i !== index));
  };

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parsePeople(String(reader.result || ''));
      setRoster(parsed);
      setTeams([]);
      // default: select "approved" if present, otherwise all statuses
      const statuses = [...new Set(parsed.map((p) => p.status))];
      setStatusFilter(statuses.includes('approved') ? ['approved'] : statuses);
      // default to checked-in only when the file has any check-in data
      setCheckedInOnly(parsed.some((p) => p.checkedIn));
    };
    reader.readAsText(file);
  };

  // distinct statuses with counts
  const statusCounts = roster.reduce<Record<string, number>>((acc, p) => {
    const key = p.status || '(no status)';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const hasStatuses = Object.keys(statusCounts).some((k) => k !== '(no status)');
  const checkedInCount = roster.filter((p) => p.checkedIn).length;
  const hasCheckins = checkedInCount > 0;

  const toggleStatus = (status: string) => {
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
    setTeams([]);
  };

  // people after status filter + optional dedupe
  const selectedPeople = (() => {
    let list = hasStatuses
      ? roster.filter((p) => statusFilter.includes(p.status))
      : roster.slice();
    if (checkedInOnly) {
      list = list.filter((p) => p.checkedIn);
    }
    if (dedupe) {
      const seen = new Set<string>();
      list = list.filter((p) => {
        const key = p.email || p.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    return list;
  })();

  const planPreview = planSizes(selectedPeople.length, teamSize, remainder);
  const dividesEvenly = selectedPeople.length > 0 && selectedPeople.length % teamSize === 0;

  const generateTeams = () => {
    if (selectedPeople.length === 0) return;
    setTeams(makeTeams(selectedPeople, teamSize, remainder));
    setPhase('results');
  };

  const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

  const exportTeams = () => {
    const lines = ['Team,Name,Email'];
    teams.forEach((team, i) => {
      team.forEach((member) =>
        lines.push(`Team ${startNumber + i},${csvCell(member.name)},${csvCell(member.email)}`)
      );
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'teams.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const logosRow = (
    <div className="cht-logos">
      {logos.map((logo, i) => (
        <div key={i} className="cht-logo-group">
          {i > 0 && <div className="cht-logo-divider" />}
          <div className="cht-logo-wrap">
            <img src={logo} alt={`Logo ${i + 1}`} />
            {logos.length > 1 && (
              <button className="cht-logo-remove" onClick={() => removeLogo(i)} title="Remove logo">
                ×
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  // ---------------- TEAMS RESULTS SCREEN ----------------
  if (phase === 'results') {
    const totalMembers = teams.reduce((sum, t) => sum + t.length, 0);
    const planDesc = describePlan(teams.map((t) => t.length));
    const q = query.trim().toLowerCase();
    const isHit = (m: Person) => !!q && (m.name.toLowerCase().includes(q) || m.email.includes(q));
    const matchCount = q ? teams.reduce((n, t) => n + t.filter(isHit).length, 0) : 0;

    return (
      <div className="cht-root cht-root-results">
        <div className="cht-results">
          {logosRow}

          <h1 className="cht-title cht-results-title">{description || 'Teams'}</h1>

          <div className="cht-results-bar">
            <div className="cht-results-stats">
              <span className="cht-results-stat-num">{totalMembers}</span> people
              <span className="cht-funnel-sep">·</span>
              {planDesc}
            </div>
            <div className="cht-results-actions">
              <div className="cht-search">
                <input
                  className="cht-search-input"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find a name…"
                />
                {q && <span className="cht-search-count">{matchCount}</span>}
                {query && (
                  <button
                    className="cht-search-clear"
                    onClick={() => setQuery('')}
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
              <button className="cht-btn" onClick={generateTeams}>
                Shuffle again
              </button>
              <button className="cht-btn" onClick={exportTeams}>
                Export CSV
              </button>
              <button className="cht-btn" onClick={() => setPhase('setup')}>
                Back
              </button>
            </div>
          </div>

          <div className="cht-teams-grid">
            {teams.map((team, i) => {
              const teamHit = q ? team.some(isHit) : false;
              return (
                <div
                  className={`cht-team-card${q && !teamHit ? ' cht-team-dim' : ''}${
                    teamHit ? ' cht-team-active' : ''
                  }`}
                  key={i}
                >
                  <div className="cht-team-head">
                    <span className="cht-team-name">Team {startNumber + i}</span>
                    <span className="cht-team-count">{team.length}</span>
                    {team.length < teamSize && <span className="cht-team-badge">small</span>}
                    {team.length > teamSize && (
                      <span className="cht-team-badge cht-team-badge-big">
                        +{team.length - teamSize}
                      </span>
                    )}
                  </div>
                  <ul className="cht-team-list">
                    {team.map((member, j) => (
                      <li key={j} className={isHit(member) ? 'cht-member-hit' : ''}>
                        <span className="cht-member-av">{initials(member.name)}</span>
                        <span className="cht-member-info">
                          <span className="cht-member-name">{member.name}</span>
                          {member.email && (
                            <span className="cht-member-email" title={member.email}>
                              {member.email}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ---------------- TEAMS SETUP SCREEN ----------------
  return (
    <div className="cht-root">
      <div className="cht-setup">
        {logosRow}

        <h1 className="cht-title">Team Shuffle</h1>
        <p className="cht-subtitle">Upload a CSV of people and split them into random teams</p>

        <div className="cht-field">
          <label className="cht-label">Event name (optional)</label>
          <input
            className="cht-input cht-desc"
            type="text"
            maxLength={80}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Cursor Hackathon Bishkek"
          />
          <div className="cht-counter">{description.length}/80</div>
        </div>

        <div className="cht-field">
          <label className="cht-label">People list (CSV)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            onChange={handleFile}
            style={{ display: 'none' }}
          />
          <div className="cht-upload-row">
            <button className="cht-upload-btn" onClick={() => fileInputRef.current?.click()}>
              Choose CSV file
            </button>
            <span className="cht-upload-info">
              {fileName
                ? `${fileName} — ${roster.length} rows · ${selectedPeople.length} selected`
                : 'No file selected'}
            </span>
          </div>
        </div>

        {roster.length > 0 && (
          <div className="cht-field">
            <label className="cht-label">Filters</label>

            {hasStatuses && (
              <div className="cht-filter-group">
                <span className="cht-filter-sublabel">
                  Approval status
                  <span className="cht-filter-hint">tap to include / exclude</span>
                </span>
                <div className="cht-status-row">
                  {Object.entries(statusCounts).map(([status, count]) => {
                    const on = statusFilter.includes(status);
                    return (
                      <button
                        key={status}
                        className={`cht-status-chip ${on ? 'cht-status-active' : ''}`}
                        onClick={() => toggleStatus(status)}
                        aria-pressed={on}
                      >
                        <span className="cht-chip-check">{on ? '✓' : '+'}</span>
                        {status} <span className="cht-status-count">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="cht-filter-group">
              <span className="cht-filter-sublabel">Refine</span>
              <div className="cht-status-row">
                {hasCheckins && (
                  <label className="cht-toggle">
                    <input
                      type="checkbox"
                      checked={checkedInOnly}
                      onChange={(e) => {
                        setCheckedInOnly(e.target.checked);
                        setTeams([]);
                      }}
                    />
                    <span>Checked-in only</span>
                    <span className="cht-status-count">{checkedInCount}</span>
                  </label>
                )}
                <label className="cht-toggle">
                  <input
                    type="checkbox"
                    checked={dedupe}
                    onChange={(e) => {
                      setDedupe(e.target.checked);
                      setTeams([]);
                    }}
                  />
                  <span>Remove duplicates</span>
                </label>
              </div>
            </div>

            <div className="cht-filter-summary">
              <span className="cht-funnel-final">{selectedPeople.length}</span>
              <span className="cht-funnel-text">people selected</span>
              <span className="cht-funnel-sep">→</span>
              <span className="cht-funnel-text">
                {planPreview.length ? describePlan(planPreview) : '—'}
              </span>
            </div>
          </div>
        )}

        <div className="cht-field">
          <label className="cht-label">Team size</label>
          <div className="cht-size-row">
            {[2, 3, 4, 5].map((n) => (
              <button
                key={n}
                className={`cht-size-btn ${teamSize === n ? 'cht-size-active' : ''}`}
                onClick={() => {
                  setTeamSize(n);
                  setTeams([]);
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="cht-field">
          <label className="cht-label">If it doesn't divide evenly</label>
          <div className="cht-mode-row">
            <button
              className={`cht-mode-btn ${remainder === 'separate' ? 'cht-mode-active' : ''}`}
              onClick={() => {
                setRemainder('separate');
                setTeams([]);
              }}
              aria-pressed={remainder === 'separate'}
            >
              <span className="cht-mode-title">Separate smaller team</span>
              <span className="cht-mode-desc">Leftover people form one smaller team</span>
            </button>
            <button
              className={`cht-mode-btn ${remainder === 'distribute' ? 'cht-mode-active' : ''}`}
              onClick={() => {
                setRemainder('distribute');
                setTeams([]);
              }}
              aria-pressed={remainder === 'distribute'}
            >
              <span className="cht-mode-title">Spread into bigger teams</span>
              <span className="cht-mode-desc">Leftover people join existing teams</span>
            </button>
          </div>
          {dividesEvenly && (
            <p className="cht-mode-note">Splits evenly — no leftover people.</p>
          )}
        </div>

        <button
          className="cht-start-btn"
          onClick={generateTeams}
          disabled={selectedPeople.length === 0}
        >
          {`Generate teams${selectedPeople.length ? ` (${selectedPeople.length})` : ''}`}
        </button>
      </div>
    </div>
  );
}
