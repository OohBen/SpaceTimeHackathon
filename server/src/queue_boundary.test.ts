import { type Identity, Timestamp } from 'spacetimedb';
import { describe, expect, it } from 'vitest';

import {
  runDeliberationReducer,
  setDeliberationModeReducer,
  type DecisionReducerContext,
  type ModuleSettingsRow,
} from './turn_decisions.js';
import {
  LLM_QUEUE_AUTHORITATIVE_CONTRACT,
  LLM_REQUEST_STATUS,
} from './llm_queue_contract.js';
import {
  buildTurn1Seed,
  type CityRow,
  type LlmRequestRow,
  type PersonnelRow,
  type ProposalRow,
} from './turn1_seed.js';

const timestamp = Timestamp.UNIX_EPOCH;

type Rows = {
  sessions: ReturnType<typeof buildTurn1Seed>['game_sessions'];
  factions: ReturnType<typeof buildTurn1Seed>['factions'];
  proposals: ProposalRow[];
  cities: CityRow[];
  personnel: PersonnelRow[];
  llmRequests: LlmRequestRow[];
  moduleSettings: ModuleSettingsRow[];
  nextProposalId: number;
};

function makeRows(phase: 'deliberation' | 'decision' = 'deliberation'): Rows {
  const seed = buildTurn1Seed();
  return {
    sessions: seed.game_sessions.map((session) => ({ ...session, turn_phase: phase })),
    factions: seed.factions.map((faction) => ({ ...faction })),
    proposals: seed.proposals.map((proposal) => ({ ...proposal })),
    cities: seed.cities.map((city) => ({ ...city })) as CityRow[],
    personnel: seed.personnel.map((person) => ({ ...person })) as PersonnelRow[],
    llmRequests: [],
    moduleSettings: [],
    nextProposalId: seed.proposals.reduce((max, p) => Math.max(max, p.id), 0) + 1,
  };
}

function makeCtx(sender: Identity, rows: Rows): DecisionReducerContext {
  return {
    sender,
    timestamp,
    db: {
      game_sessions: {
        id: { find: (id) => rows.sessions.find((s) => s.id === id) ?? null },
      },
      factions: {
        id: {
          find: (id) => rows.factions.find((f) => f.id === id) ?? null,
          update: (row) => {
            const idx = rows.factions.findIndex((f) => f.id === row.id);
            if (idx === -1) throw new Error(`faction ${row.id}`);
            rows.factions[idx] = row;
            return row;
          },
        },
      },
      proposals: {
        id: {
          find: (id) => rows.proposals.find((p) => p.id === id) ?? null,
          update: (row) => {
            const idx = rows.proposals.findIndex((p) => p.id === row.id);
            if (idx === -1) throw new Error(`proposal ${row.id}`);
            rows.proposals[idx] = row;
            return row;
          },
        },
        iter: () => rows.proposals.values(),
        insert: (row) => {
          const inserted = { ...row, id: rows.nextProposalId };
          rows.nextProposalId += 1;
          rows.proposals.push(inserted);
          return inserted;
        },
      },
      cities: { iter: () => rows.cities.values() },
      personnel: { iter: () => rows.personnel.values() },
      llm_requests: {
        iter: () => rows.llmRequests.values(),
        insert: (row) => {
          const inserted = { ...row, id: rows.llmRequests.length + 1 };
          rows.llmRequests.push(inserted);
          return inserted;
        },
      },
      module_settings: {
        id: {
          find: (id) => rows.moduleSettings.find((s) => s.id === id) ?? null,
          update: (row) => {
            const idx = rows.moduleSettings.findIndex((s) => s.id === row.id);
            if (idx === -1) throw new Error(`module_settings ${row.id}`);
            rows.moduleSettings[idx] = row;
            return row;
          },
        },
        insert: (row) => {
          rows.moduleSettings.push({ ...row });
          return row;
        },
      },
    },
  };
}

describe('queue boundary — queued request shape', () => {
  it('creates exactly one queued llm_requests row in queue mode (default)', () => {
    const rows = makeRows();
    const faction = rows.factions[0];

    runDeliberationReducer(makeCtx(faction.player_id, rows), {
      faction_id: faction.id,
    });

    expect(rows.llmRequests).toHaveLength(1);
    const queued = rows.llmRequests[0];
    expect(queued.status).toBe(LLM_REQUEST_STATUS.queued);
    expect(queued.response_json).toBeUndefined();
    expect(queued.error).toBeUndefined();
    expect(queued.error_code).toBeUndefined();
    expect(queued.attempt_count).toBe(0);
  });

  it('does not insert proposals when only queueing (worker will deliver advisory text)', () => {
    const rows = makeRows();
    const faction = rows.factions[0];
    const before = rows.proposals.filter(
      (p) => p.faction_id === faction.id && p.turn === rows.sessions[0].current_turn
    ).length;

    runDeliberationReducer(makeCtx(faction.player_id, rows), {
      faction_id: faction.id,
    });

    const after = rows.proposals.filter(
      (p) => p.faction_id === faction.id && p.turn === rows.sessions[0].current_turn
    ).length;
    expect(after).toBe(before);
  });

  it('reuses the failed audit slot when fallback is unavailable so the turn keeps moving', () => {
    const rows = makeRows();
    rows.moduleSettings.push({ id: 1, deliberation_mode: 'fallback' });
    const faction = rows.factions[0];
    rows.cities = rows.cities.filter((c) => c.faction_id !== faction.id);
    rows.personnel = rows.personnel.filter((p) => p.faction_id !== faction.id);

    runDeliberationReducer(makeCtx(faction.player_id, rows), {
      faction_id: faction.id,
    });

    expect(rows.llmRequests).toHaveLength(1);
    expect(rows.llmRequests[0].status).toBe(LLM_REQUEST_STATUS.failed);

    runDeliberationReducer(makeCtx(faction.player_id, rows), {
      faction_id: faction.id,
    });

    expect(rows.llmRequests).toHaveLength(2);
    expect(rows.llmRequests.every((r) => r.status === LLM_REQUEST_STATUS.failed)).toBe(true);
  });
});

describe('queue boundary — no_live_dependency invariant', () => {
  it('completes run_deliberation without calling Math.random or Date.now in either mode', () => {
    const originalRandom = Math.random;
    const originalNow = Date.now;
    Math.random = () => {
      throw new Error('Math.random must not be used inside run_deliberation');
    };
    Date.now = () => {
      throw new Error('Date.now must not be used inside run_deliberation');
    };

    try {
      const queueRows = makeRows();
      const factionQ = queueRows.factions[0];
      runDeliberationReducer(makeCtx(factionQ.player_id, queueRows), {
        faction_id: factionQ.id,
      });

      const fallbackRows = makeRows();
      fallbackRows.moduleSettings.push({ id: 1, deliberation_mode: 'fallback' });
      const factionF = fallbackRows.factions[0];
      runDeliberationReducer(makeCtx(factionF.player_id, fallbackRows), {
        faction_id: factionF.id,
      });

      expect(queueRows.llmRequests).toHaveLength(1);
      expect(fallbackRows.llmRequests).toHaveLength(1);
    } finally {
      Math.random = originalRandom;
      Date.now = originalNow;
    }
  });

  it('does not read or require any process.env values', () => {
    const trap = new Proxy(
      {},
      {
        get(_target, key) {
          throw new Error(`environment variable ${String(key)} must not be read by run_deliberation`);
        },
        has() {
          throw new Error('environment variables must not be probed by run_deliberation');
        },
      }
    );
    const originalEnv = process.env;
    (process as { env: NodeJS.ProcessEnv }).env = trap as NodeJS.ProcessEnv;

    try {
      const rows = makeRows();
      const faction = rows.factions[0];
      runDeliberationReducer(makeCtx(faction.player_id, rows), {
        faction_id: faction.id,
      });
    } finally {
      (process as { env: NodeJS.ProcessEnv }).env = originalEnv;
    }
  });

  it('declares live_model_required false so simulation outcomes never depend on a worker', () => {
    expect(LLM_QUEUE_AUTHORITATIVE_CONTRACT.live_model_required).toBe(false);
    expect(LLM_QUEUE_AUTHORITATIVE_CONTRACT.worker_output_role).toBe('advisory_text_only');
  });

  it('produces byte-identical queued rows across repeated calls on identical state', () => {
    const a = makeRows();
    const b = makeRows();
    runDeliberationReducer(makeCtx(a.factions[0].player_id, a), {
      faction_id: a.factions[0].id,
    });
    runDeliberationReducer(makeCtx(b.factions[0].player_id, b), {
      faction_id: b.factions[0].id,
    });

    expect(a.llmRequests).toEqual(b.llmRequests);
  });

  it('produces byte-identical fallback proposals across repeated calls on identical state', () => {
    const a = makeRows();
    a.moduleSettings.push({ id: 1, deliberation_mode: 'fallback' });
    const b = makeRows();
    b.moduleSettings.push({ id: 1, deliberation_mode: 'fallback' });

    runDeliberationReducer(makeCtx(a.factions[0].player_id, a), {
      faction_id: a.factions[0].id,
    });
    runDeliberationReducer(makeCtx(b.factions[0].player_id, b), {
      faction_id: b.factions[0].id,
    });

    const stripIds = <T extends { id?: number } & Record<string, unknown>>(rows: T[]) =>
      rows.map(({ id: _id, ...rest }) => rest);
    expect(stripIds(a.llmRequests)).toEqual(stripIds(b.llmRequests));

    const factionId = a.factions[0].id;
    const turn = a.sessions[0].current_turn;
    const aFallback = a.proposals.filter((p) => p.faction_id === factionId && p.turn === turn);
    const bFallback = b.proposals.filter((p) => p.faction_id === factionId && p.turn === turn);
    expect(stripIds(aFallback)).toEqual(stripIds(bFallback));
  });
});

describe('queue boundary — manual mode toggle is observable', () => {
  it('exposes deliberation_mode through module_settings so devs can flip without secrets', () => {
    const rows = makeRows();
    const faction = rows.factions[0];

    setDeliberationModeReducer(makeCtx(faction.player_id, rows), {
      mode: 'fallback',
    });

    expect(rows.moduleSettings).toEqual([{ id: 1, deliberation_mode: 'fallback' }]);

    setDeliberationModeReducer(makeCtx(faction.player_id, rows), {
      mode: 'queue',
    });

    expect(rows.moduleSettings).toEqual([{ id: 1, deliberation_mode: 'queue' }]);
  });

  it('records context_json marking fallback mode so devs inspecting llm_requests see the path used', () => {
    const rows = makeRows();
    rows.moduleSettings.push({ id: 1, deliberation_mode: 'fallback' });
    const faction = rows.factions[0];

    runDeliberationReducer(makeCtx(faction.player_id, rows), {
      faction_id: faction.id,
    });

    expect(rows.llmRequests).toHaveLength(1);
    const audit = rows.llmRequests[0];
    const ctx = JSON.parse(audit.context_json) as Record<string, unknown>;
    expect(ctx.mode).toBe('fallback');
    expect(ctx.request).toBe('run_deliberation');
  });
});
