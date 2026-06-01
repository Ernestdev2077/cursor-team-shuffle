import { useState } from 'react';
import type { ChangeEvent } from 'react';
import './TeamShuffle.css';
import cursorLogo from './assets/cursor_logo.svg';
import SetupScreen from './components/SetupScreen';
import ResultsScreen from './components/ResultsScreen';
import {
  countStatuses,
  downloadFile,
  filterPeople,
  makeTeams,
  parsePeople,
  planSizes,
  teamsToCSV,
  type Person,
  type Remainder,
} from './lib/teams';

const DEFAULT_LOGOS = [cursorLogo];
const START_NUMBER = 1; // teams are numbered from here

type Phase = 'setup' | 'results';

export default function TeamShuffle() {
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
  const [fileName, setFileName] = useState('');

  const removeLogo = (index: number) => setLogos(logos.filter((_, i) => i !== index));

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

  // derived data
  const statusCounts = countStatuses(roster);
  const hasStatuses = Object.keys(statusCounts).some((k) => k !== '(no status)');
  const checkedInCount = roster.filter((p) => p.checkedIn).length;
  const hasCheckins = checkedInCount > 0;

  const selectedPeople = filterPeople(roster, { statusFilter, hasStatuses, checkedInOnly, dedupe });
  const planPreview = planSizes(selectedPeople.length, teamSize, remainder);
  const dividesEvenly = selectedPeople.length > 0 && selectedPeople.length % teamSize === 0;

  // changing any filter/size/mode invalidates the previously generated teams
  const invalidate = () => setTeams([]);

  const toggleStatus = (status: string) => {
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
    invalidate();
  };

  const generateTeams = () => {
    if (selectedPeople.length === 0) return;
    setTeams(makeTeams(selectedPeople, teamSize, remainder));
    setPhase('results');
  };

  const exportTeams = () => downloadFile('teams.csv', teamsToCSV(teams, START_NUMBER));

  if (phase === 'results') {
    return (
      <ResultsScreen
        logos={logos}
        onRemoveLogo={removeLogo}
        title={description || 'Teams'}
        teams={teams}
        teamSize={teamSize}
        startNumber={START_NUMBER}
        query={query}
        onQueryChange={setQuery}
        onShuffle={generateTeams}
        onExport={exportTeams}
        onBack={() => setPhase('setup')}
      />
    );
  }

  return (
    <SetupScreen
      logos={logos}
      onRemoveLogo={removeLogo}
      description={description}
      onDescriptionChange={setDescription}
      fileName={fileName}
      roster={roster}
      selectedPeople={selectedPeople}
      onFile={handleFile}
      statusCounts={statusCounts}
      hasStatuses={hasStatuses}
      statusFilter={statusFilter}
      onToggleStatus={toggleStatus}
      hasCheckins={hasCheckins}
      checkedInOnly={checkedInOnly}
      onCheckedInOnlyChange={(v) => {
        setCheckedInOnly(v);
        invalidate();
      }}
      checkedInCount={checkedInCount}
      dedupe={dedupe}
      onDedupeChange={(v) => {
        setDedupe(v);
        invalidate();
      }}
      planPreview={planPreview}
      teamSize={teamSize}
      onTeamSizeChange={(n) => {
        setTeamSize(n);
        invalidate();
      }}
      remainder={remainder}
      onRemainderChange={(m) => {
        setRemainder(m);
        invalidate();
      }}
      dividesEvenly={dividesEvenly}
      onGenerate={generateTeams}
    />
  );
}
