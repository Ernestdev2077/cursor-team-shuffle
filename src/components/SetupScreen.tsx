import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import LogoBar from './LogoBar';
import { describePlan, type Person, type Remainder } from '../lib/teams';

interface SetupScreenProps {
  logos: string[];
  onRemoveLogo: (index: number) => void;

  description: string;
  onDescriptionChange: (value: string) => void;

  fileName: string;
  roster: Person[];
  selectedPeople: Person[];
  onFile: (e: ChangeEvent<HTMLInputElement>) => void;

  statusCounts: Record<string, number>;
  hasStatuses: boolean;
  statusFilter: string[];
  onToggleStatus: (status: string) => void;

  hasCheckins: boolean;
  checkedInOnly: boolean;
  onCheckedInOnlyChange: (value: boolean) => void;
  checkedInCount: number;

  dedupe: boolean;
  onDedupeChange: (value: boolean) => void;

  planPreview: number[];

  teamSize: number;
  onTeamSizeChange: (size: number) => void;

  remainder: Remainder;
  onRemainderChange: (mode: Remainder) => void;
  dividesEvenly: boolean;

  onGenerate: () => void;
}

const TEAM_SIZES = [2, 3, 4, 5];

export default function SetupScreen(props: SetupScreenProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { roster, selectedPeople } = props;

  return (
    <div className="cht-root">
      <div className="cht-setup">
        <LogoBar logos={props.logos} onRemove={props.onRemoveLogo} />

        <h1 className="cht-title">Team Shuffle</h1>
        <p className="cht-subtitle">Upload a CSV of people and split them into random teams</p>

        <div className="cht-field">
          <label className="cht-label">Event name (optional)</label>
          <input
            className="cht-input cht-desc"
            type="text"
            maxLength={80}
            value={props.description}
            onChange={(e) => props.onDescriptionChange(e.target.value)}
            placeholder="e.g., Cursor Hackathon Bishkek"
          />
          <div className="cht-counter">{props.description.length}/80</div>
        </div>

        <div className="cht-field">
          <label className="cht-label">People list (CSV)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            onChange={props.onFile}
            style={{ display: 'none' }}
          />
          <div className="cht-upload-row">
            <button className="cht-upload-btn" onClick={() => fileInputRef.current?.click()}>
              Choose CSV file
            </button>
            <span className="cht-upload-info">
              {props.fileName
                ? `${props.fileName} — ${roster.length} rows · ${selectedPeople.length} selected`
                : 'No file selected'}
            </span>
          </div>
        </div>

        {roster.length > 0 && (
          <div className="cht-field">
            <label className="cht-label">Filters</label>

            {props.hasStatuses && (
              <div className="cht-filter-group">
                <span className="cht-filter-sublabel">
                  Approval status
                  <span className="cht-filter-hint">tap to include / exclude</span>
                </span>
                <div className="cht-status-row">
                  {Object.entries(props.statusCounts).map(([status, count]) => {
                    const on = props.statusFilter.includes(status);
                    return (
                      <button
                        key={status}
                        className={`cht-status-chip ${on ? 'cht-status-active' : ''}`}
                        onClick={() => props.onToggleStatus(status)}
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
                {props.hasCheckins && (
                  <label className="cht-toggle">
                    <input
                      type="checkbox"
                      checked={props.checkedInOnly}
                      onChange={(e) => props.onCheckedInOnlyChange(e.target.checked)}
                    />
                    <span>Checked-in only</span>
                    <span className="cht-status-count">{props.checkedInCount}</span>
                  </label>
                )}
                <label className="cht-toggle">
                  <input
                    type="checkbox"
                    checked={props.dedupe}
                    onChange={(e) => props.onDedupeChange(e.target.checked)}
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
                {props.planPreview.length ? describePlan(props.planPreview) : '—'}
              </span>
            </div>
          </div>
        )}

        <div className="cht-field">
          <label className="cht-label">Team size</label>
          <div className="cht-size-row">
            {TEAM_SIZES.map((n) => (
              <button
                key={n}
                className={`cht-size-btn ${props.teamSize === n ? 'cht-size-active' : ''}`}
                onClick={() => props.onTeamSizeChange(n)}
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
              className={`cht-mode-btn ${props.remainder === 'separate' ? 'cht-mode-active' : ''}`}
              onClick={() => props.onRemainderChange('separate')}
              aria-pressed={props.remainder === 'separate'}
            >
              <span className="cht-mode-title">Separate smaller team</span>
              <span className="cht-mode-desc">Leftover people form one smaller team</span>
            </button>
            <button
              className={`cht-mode-btn ${props.remainder === 'distribute' ? 'cht-mode-active' : ''}`}
              onClick={() => props.onRemainderChange('distribute')}
              aria-pressed={props.remainder === 'distribute'}
            >
              <span className="cht-mode-title">Spread into bigger teams</span>
              <span className="cht-mode-desc">Leftover people join existing teams</span>
            </button>
          </div>
          {props.dividesEvenly && (
            <p className="cht-mode-note">Splits evenly — no leftover people.</p>
          )}
        </div>

        <button
          className="cht-start-btn"
          onClick={props.onGenerate}
          disabled={selectedPeople.length === 0}
        >
          {`Generate teams${selectedPeople.length ? ` (${selectedPeople.length})` : ''}`}
        </button>
      </div>
    </div>
  );
}
