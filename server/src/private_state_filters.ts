import {
  canReadFactionPrivateData,
  type IdentityScope,
} from './access_policy.js';
import type {
  CommanderInboxRow,
  FactionRow,
  IntelligenceRecordRow,
  LlmRequestRow,
  PersonnelRelationshipRow,
  PersonnelRow,
  ProjectRow,
  ProposalRow,
  TradeAgreementRow,
  Turn1SeedRows,
  TurnSummaryRow,
} from './turn1_seed.js';

export const PRIVATE_COMMAND_TABLES = [
  'personnel',
  'personnel_relationships',
  'proposals',
  'commander_inbox',
  'projects',
  'intelligence_records',
  'turn_summaries',
  'trade_agreements',
  'llm_requests',
] as const;

export type PrivateCommandTable = typeof PRIVATE_COMMAND_TABLES[number];

export type PrivateCommandState = {
  personnel: PersonnelRow[];
  personnel_relationships: PersonnelRelationshipRow[];
  proposals: ProposalRow[];
  commander_inbox: CommanderInboxRow[];
  projects: ProjectRow[];
  intelligence_records: IntelligenceRecordRow[];
  turn_summaries: TurnSummaryRow[];
  trade_agreements: TradeAgreementRow[];
  llm_requests: LlmRequestRow[];
};

type FactionOwnedRow = {
  faction_id: number;
};

export function filterPrivateCommandState(
  rows: Turn1SeedRows,
  scope: IdentityScope
): PrivateCommandState {
  const visibleScope = scopeForSessionFactions(rows.factions, scope);
  const personnel = filterRowsByFaction(rows.personnel, visibleScope);
  const visiblePersonnelIds = new Set(personnel.map((row) => row.id));

  return {
    personnel,
    personnel_relationships: rows.personnel_relationships.filter(
      (row) =>
        visiblePersonnelIds.has(row.personnel_a_id) &&
        visiblePersonnelIds.has(row.personnel_b_id)
    ),
    proposals: filterRowsByFaction(rows.proposals, visibleScope),
    commander_inbox: filterRowsByFaction(rows.commander_inbox, visibleScope),
    projects: filterRowsByFaction(rows.projects, visibleScope),
    intelligence_records: filterIntelligenceRows(rows.intelligence_records, visibleScope),
    turn_summaries: filterRowsByFaction(rows.turn_summaries, visibleScope),
    trade_agreements: filterTradeAgreements(rows.trade_agreements, visibleScope),
    llm_requests: filterRowsByFaction(rows.llm_requests, visibleScope),
  };
}

export function filterRowsByFaction<T extends FactionOwnedRow>(
  rows: readonly T[],
  scope: IdentityScope
): T[] {
  return rows.filter((row) => canReadFactionPrivateData(scope, row.faction_id));
}

function filterIntelligenceRows(
  rows: readonly IntelligenceRecordRow[],
  scope: IdentityScope
): IntelligenceRecordRow[] {
  return rows.filter((row) =>
    canReadFactionPrivateData(scope, row.observer_faction_id)
  );
}

function filterTradeAgreements(
  rows: readonly TradeAgreementRow[],
  scope: IdentityScope
): TradeAgreementRow[] {
  return rows.filter(
    (row) =>
      canReadFactionPrivateData(scope, row.faction_a_id) ||
      canReadFactionPrivateData(scope, row.faction_b_id)
  );
}

function scopeForSessionFactions(
  factions: readonly FactionRow[],
  scope: IdentityScope
): IdentityScope {
  const sessionFactionIds = new Set(
    factions
      .filter((faction) => faction.session_id === scope.sessionId)
      .map((faction) => faction.id)
  );

  return {
    ...scope,
    ownedFactionIds: scope.ownedFactionIds.filter((factionId) =>
      sessionFactionIds.has(factionId)
    ),
  };
}
