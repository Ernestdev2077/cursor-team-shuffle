import LogoBar from './LogoBar';
import { describePlan, initials, type Person } from '../lib/teams';

interface ResultsScreenProps {
  logos: string[];
  onRemoveLogo: (index: number) => void;

  title: string;
  teams: Person[][];
  teamSize: number;
  startNumber: number;

  query: string;
  onQueryChange: (value: string) => void;

  onShuffle: () => void;
  onExport: () => void;
  onBack: () => void;
}

export default function ResultsScreen(props: ResultsScreenProps) {
  const { teams, teamSize, startNumber } = props;
  const totalMembers = teams.reduce((sum, t) => sum + t.length, 0);
  const planDesc = describePlan(teams.map((t) => t.length));

  const q = props.query.trim().toLowerCase();
  const isHit = (m: Person) => !!q && (m.name.toLowerCase().includes(q) || m.email.includes(q));
  const matchCount = q ? teams.reduce((n, t) => n + t.filter(isHit).length, 0) : 0;

  return (
    <div className="cht-root cht-root-results">
      <div className="cht-results">
        <LogoBar logos={props.logos} onRemove={props.onRemoveLogo} />

        <h1 className="cht-title cht-results-title">{props.title}</h1>

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
                value={props.query}
                onChange={(e) => props.onQueryChange(e.target.value)}
                placeholder="Find a name…"
              />
              {q && <span className="cht-search-count">{matchCount}</span>}
              {props.query && (
                <button
                  className="cht-search-clear"
                  onClick={() => props.onQueryChange('')}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>
            <button className="cht-btn" onClick={props.onShuffle}>
              Shuffle again
            </button>
            <button className="cht-btn" onClick={props.onExport}>
              Export CSV
            </button>
            <button className="cht-btn" onClick={props.onBack}>
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
