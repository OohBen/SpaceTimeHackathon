import type { FactionRow } from './session_lifecycle.js';
import type { CityRow, ProposalRow } from './turn1_seed.js';

export interface EconomyRulesContext {
  db: {
    factions: {
      id: {
        find(id: number): FactionRow | null;
        update(row: FactionRow): FactionRow;
      };
    };
    cities: {
      iter(): Iterable<CityRow>;
      id: {
        update(row: CityRow): CityRow;
      };
    };
    proposals: {
      iter(): Iterable<ProposalRow>;
    };
  };
}

export interface EconomyUpdateResult {
  morale_deltas: Record<number, number>;
  political_capital_after: Record<number, number>;
}

// Morale drifts based on supply status each world-update; clamped to [0, 100].
export function applyMoraleDrift(
  ctx: EconomyRulesContext,
  factionIds: readonly [number, number]
): Record<number, number> {
  const [idA, idB] = factionIds;
  const deltas: Record<number, number> = {};

  const cities = sortById(
    [...ctx.db.cities.iter()].filter(city => city.faction_id === idA || city.faction_id === idB)
  );

  for (const city of cities) {
    const delta = supplyMoraleDelta(city.supply_status);
    const newMorale = clamp(city.morale + delta, 0, 100);
    if (newMorale !== city.morale) {
      ctx.db.cities.id.update({ ...city, morale: newMorale });
    }
    deltas[city.id] = delta;
  }

  return deltas;
}

function supplyMoraleDelta(supplyStatus: string): number {
  if (supplyStatus === 'strained') return -2;
  if (supplyStatus === 'critical') return -5;
  if (supplyStatus === 'stable') return 1;
  return 0;
}

// Political capital decays 5% per turn (floor), minimum 0.
export function applyPoliticalCapitalDecay(
  ctx: EconomyRulesContext,
  factionIds: readonly [number, number]
): Record<number, number> {
  const result: Record<number, number> = {};

  for (const factionId of sortIds(factionIds)) {
    const faction = ctx.db.factions.id.find(factionId);
    if (!faction) throw new Error(`faction ${factionId} not found`);
    const decayed = Math.max(0, Math.floor(faction.political_capital * 0.95));
    if (decayed !== faction.political_capital) {
      ctx.db.factions.id.update({ ...faction, political_capital: decayed });
    }
    result[factionId] = decayed;
  }

  return result;
}

// Doctrine axes drift +0.02 per approved proposal from mapped departments; clamped [0, 1].
const DEPARTMENT_TO_AXIS: Record<string, string> = {
  Colonization: 'expansion',
  Defense: 'security',
  Diplomatic: 'diplomacy',
  Executive: 'expansion',
  Intelligence: 'security',
  Military: 'security',
  Research: 'science',
  Science: 'science',
};

export function applyDoctrineDrift(
  ctx: EconomyRulesContext,
  factionIds: readonly [number, number],
  previousTurn: number
): void {
  if (previousTurn <= 0) return;

  const [idA, idB] = factionIds;
  const approved = sortById(
    [...ctx.db.proposals.iter()].filter(
      p =>
        (p.faction_id === idA || p.faction_id === idB) &&
        p.turn === previousTurn &&
        p.status === 'approved'
    )
  );

  const drift: Record<number, Record<string, number>> = { [idA]: {}, [idB]: {} };

  for (const proposal of approved) {
    const axis = DEPARTMENT_TO_AXIS[proposal.department];
    if (!axis) continue;
    drift[proposal.faction_id][axis] = (drift[proposal.faction_id][axis] ?? 0) + 0.02;
  }

  for (const factionId of sortIds(factionIds)) {
    const factionDrift = drift[factionId];
    if (Object.keys(factionDrift).length === 0) continue;

    const faction = ctx.db.factions.id.find(factionId);
    if (!faction) throw new Error(`faction ${factionId} not found`);

    const doctrine: Record<string, number> = JSON.parse(faction.doctrine_vector);
    let changed = false;

    for (const [axis, delta] of Object.entries(factionDrift)) {
      const updated = clamp((doctrine[axis] ?? 0.5) + delta, 0, 1);
      doctrine[axis] = round2(updated);
      changed = true;
    }

    if (changed) {
      ctx.db.factions.id.update({ ...faction, doctrine_vector: stableJson(doctrine) });
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function sortById<T extends { id: number }>(rows: T[]): T[] {
  return rows.slice().sort((a, b) => a.id - b.id);
}

function sortIds(ids: readonly number[]): number[] {
  return ids.slice().sort((a, b) => a - b);
}

const stableJson = (value: unknown): string => JSON.stringify(stableValue(value));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value === undefined) return null;
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(key => [key, stableValue(value[key])])
  );
};
