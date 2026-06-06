import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Identity, Timestamp } from 'spacetimedb';
import { describe, expect, it } from 'vitest';
import {
  advanceTurnPhaseReducer,
  advanceWorldReducer,
  ALLOWED_TURN_PHASE_TRANSITIONS,
  ACTIVE_SESSION_STATE,
  buildSessionLifecycleRows,
  buildSlotIdentity,
  createSessionReducer,
  INITIAL_SESSION_STATE,
  INITIAL_TURN,
  INITIAL_TURN_PHASE,
  INITIAL_YEAR,
  joinOrResumeSession,
  joinOrResumeSessionReducer,
  normalizeCreateSessionInput,
  parseTurnPhase,
  transitionTurnPhase,
  TURN_PHASES,
  type CreateSessionInput,
  type FactionRow,
  type GameSessionRow,
  type JoinOrResumeContext,
  type SessionLifecycleContext,
  type TurnPhaseContext,
} from './session_lifecycle.js';
import type { WorldUpdateContext } from './simulation_kernel.js';

const timestamp = Timestamp.UNIX_EPOCH;
const srcPath = (file: string) => resolve(import.meta.dirname, file);

function makeFakeContext(): SessionLifecycleContext & {
  sessions: GameSessionRow[];
  factions: FactionRow[];
} {
  const sessions: GameSessionRow[] = [];
  const factions: FactionRow[] = [];

  return {
    timestamp,
    sessions,
    factions,
    db: {
      game_sessions: {
        iter: () => sessions.values(),
        insert: row => {
          const inserted = { ...row, id: sessions.length + 1 };
          sessions.push(inserted);
          return inserted;
        },
        id: {
          update: row => {
            const index = sessions.findIndex(session => session.id === row.id);
            if (index === -1) {
              throw new Error(`missing session ${row.id}`);
            }
            sessions[index] = row;
            return row;
          },
        },
      },
      factions: {
        iter: () => factions.values(),
        insert: row => {
          const inserted = { ...row, id: factions.length + 1 };
          factions.push(inserted);
          return inserted;
        },
      },
    },
  };
}

describe('session lifecycle builders', () => {
  it('normalizes valid faction slot names', () => {
    expect(
      normalizeCreateSessionInput({
        player_a_name: '  United   Earth  ',
        player_b_name: 'Mars Compact',
      })
    ).toEqual({
      player_a_name: 'United Earth',
      player_b_name: 'Mars Compact',
    });
  });

  it.each<CreateSessionInput>([
    { player_a_name: '', player_b_name: 'Mars Compact' },
    { player_a_name: 'United Earth', player_b_name: '   ' },
    { player_a_name: 'United Earth', player_b_name: ' united   earth ' },
  ])('rejects invalid slot setup %#', input => {
    expect(() => normalizeCreateSessionInput(input)).toThrow();
  });

  it('builds a setup session with two claimable faction slot rows', () => {
    const rows = buildSessionLifecycleRows(
      { player_a_name: 'United Earth Authority', player_b_name: 'Mars Compact' },
      timestamp,
      42,
      [101, 102]
    );

    expect(rows.session).toMatchObject({
      id: 42,
      state: INITIAL_SESSION_STATE,
      current_year: INITIAL_YEAR,
      current_turn: INITIAL_TURN,
      turn_phase: INITIAL_TURN_PHASE,
      player_a_faction_id: 101,
      player_b_faction_id: 102,
      winner_faction_id: undefined,
      turn_deadline: undefined,
    });
    expect(rows.factions).toHaveLength(2);
    expect(rows.factions.map(faction => faction.session_id)).toEqual([42, 42]);
    expect(rows.factions.map(faction => faction.name)).toEqual([
      'United Earth Authority',
      'Mars Compact',
    ]);
    expect(rows.factions.every(faction => faction.ready_for_turn === false)).toBe(
      true
    );
    expect(
      rows.factions.map(faction => JSON.parse(faction.doctrine_vector).slot)
    ).toEqual([
      {
        schema_version: 1,
        lifecycle: 'session_slot',
        slot_key: 'player_a',
        slot_index: 1,
        slot_name: 'United Earth Authority',
        claim_status: 'claimable',
        join_reducer: 'join_or_resume_session',
        resume_key: 'session_id+player_slot',
        placeholder_player_id: buildSlotIdentity(42, 'player_a').toHexString(),
      },
      {
        schema_version: 1,
        lifecycle: 'session_slot',
        slot_key: 'player_b',
        slot_index: 2,
        slot_name: 'Mars Compact',
        claim_status: 'claimable',
        join_reducer: 'join_or_resume_session',
        resume_key: 'session_id+player_slot',
        placeholder_player_id: buildSlotIdentity(42, 'player_b').toHexString(),
      },
    ]);
  });
});

describe('create_session reducer', () => {
  it('registers through the module entrypoint using spacetimedb.reducer', () => {
    const src = readFileSync(srcPath('index.ts'), 'utf8');

    expect(src).toMatch(/export\s+const\s+create_session\s*=/);
    expect(src).toMatch(/spacetimedb\.reducer\s*\(/);
    expect(src).toContain('player_a_name: t.string()');
    expect(src).toContain('player_b_name: t.string()');
    expect(src).toMatch(/from ['"]\.\/session_lifecycle\.js['"]/);
  });

  it('writes one setup session and stable faction slot rows', () => {
    const ctx = makeFakeContext();

    createSessionReducer(ctx, {
      player_a_name: 'United Earth Authority',
      player_b_name: 'Mars Compact',
    });

    expect(ctx.sessions).toHaveLength(1);
    expect(ctx.factions).toHaveLength(2);
    expect(ctx.sessions[0]).toMatchObject({
      id: 1,
      state: INITIAL_SESSION_STATE,
      current_year: INITIAL_YEAR,
      current_turn: INITIAL_TURN,
      turn_phase: INITIAL_TURN_PHASE,
      player_a_faction_id: 1,
      player_b_faction_id: 2,
    });
    expect(ctx.factions.map(faction => faction.session_id)).toEqual([1, 1]);
    expect(ctx.factions.map(faction => faction.name)).toEqual([
      'United Earth Authority',
      'Mars Compact',
    ]);
    expect(ctx.factions.map(faction => faction.player_id.toHexString())).toEqual([
      buildSlotIdentity(1, 'player_a').toHexString(),
      buildSlotIdentity(1, 'player_b').toHexString(),
    ]);
  });

  it('prevents duplicate setup sessions with the same faction slot pair', () => {
    const ctx = makeFakeContext();

    createSessionReducer(ctx, {
      player_a_name: 'United Earth Authority',
      player_b_name: 'Mars Compact',
    });

    expect(() =>
      createSessionReducer(ctx, {
        player_a_name: ' mars compact ',
        player_b_name: 'United   Earth Authority',
      })
    ).toThrow(/already exists/);
  });
});

function makeJoinResumeCtx(
  sender: Identity,
  sessions: GameSessionRow[],
  factions: FactionRow[]
): JoinOrResumeContext {
  return {
    sender,
    timestamp,
    db: {
      game_sessions: {
        id: {
          find: id => sessions.find(s => s.id === id) ?? null,
          update: row => {
            const idx = sessions.findIndex(s => s.id === row.id);
            if (idx === -1) throw new Error(`session ${row.id} not found`);
            sessions[idx] = row;
            return row;
          },
        },
      },
      factions: {
        id: {
          find: id => factions.find(f => f.id === id) ?? null,
          update: row => {
            const idx = factions.findIndex(f => f.id === row.id);
            if (idx === -1) throw new Error(`faction ${row.id} not found`);
            factions[idx] = row;
            return row;
          },
        },
      },
    },
  };
}

function makeTurnPhaseCtx(sessions: GameSessionRow[]): WorldUpdateContext {
  return {
    timestamp,
    db: {
      game_sessions: {
        id: {
          find: id => sessions.find(s => s.id === id) ?? null,
          update: row => {
            const idx = sessions.findIndex(s => s.id === row.id);
            if (idx === -1) throw new Error(`session ${row.id} not found`);
            sessions[idx] = row;
            return row;
          },
        },
      },
      factions: {
        id: {
          find: () => null,
          update: row => row,
        },
      },
      cities: { iter: () => [].values() },
      colony_ships: {
        iter: () => [].values(),
        id: { update: row => row },
      },
      projects: {
        iter: () => [].values(),
        id: { update: row => row },
      },
      events: { insert: row => row },
    },
  };
}

describe('join_or_resume_session reducer', () => {
  const playerA = Identity.fromString('a'.padStart(64, '0'));
  const playerB = Identity.fromString('b'.padStart(64, '0'));
  const playerC = Identity.fromString('c'.padStart(64, '0'));

  function setupSession() {
    const ctx = makeFakeContext();
    createSessionReducer(ctx, {
      player_a_name: 'United Earth Authority',
      player_b_name: 'Mars Compact',
    });
    return { sessions: ctx.sessions, factions: ctx.factions };
  }

  it('joins an available slot and returns bootstrap state', () => {
    const { sessions, factions } = setupSession();
    const ctx = makeJoinResumeCtx(playerA, sessions, factions);

    const result = joinOrResumeSession(ctx, { session_id: 1, player_slot: 'player_a' });

    expect(result.session_id).toBe(1);
    expect(result.slot_key).toBe('player_a');
    expect(result.is_resume).toBe(false);

    const faction = factions.find(f => f.id === result.faction_id)!;
    expect(faction.player_id.toHexString()).toBe(playerA.toHexString());
    expect(JSON.parse(faction.doctrine_vector).slot.claim_status).toBe('claimed');
  });

  it('resumes an already-claimed slot without mutation', () => {
    const { sessions, factions } = setupSession();

    joinOrResumeSession(makeJoinResumeCtx(playerA, sessions, factions), {
      session_id: 1,
      player_slot: 'player_a',
    });
    const hexBefore = factions.map(f => f.player_id.toHexString());

    const result = joinOrResumeSession(makeJoinResumeCtx(playerA, sessions, factions), {
      session_id: 1,
      player_slot: 'player_a',
    });

    expect(result.is_resume).toBe(true);
    expect(factions.map(f => f.player_id.toHexString())).toEqual(hexBefore);
  });

  it('rejects joining a slot already claimed by another player', () => {
    const { sessions, factions } = setupSession();

    joinOrResumeSession(makeJoinResumeCtx(playerA, sessions, factions), {
      session_id: 1,
      player_slot: 'player_a',
    });

    expect(() =>
      joinOrResumeSession(makeJoinResumeCtx(playerC, sessions, factions), {
        session_id: 1,
        player_slot: 'player_a',
      })
    ).toThrow(/already claimed/);
  });

  it('transitions session to active when both slots are claimed', () => {
    const { sessions, factions } = setupSession();

    joinOrResumeSession(makeJoinResumeCtx(playerA, sessions, factions), {
      session_id: 1,
      player_slot: 'player_a',
    });
    expect(sessions[0].state).toBe(INITIAL_SESSION_STATE);

    joinOrResumeSession(makeJoinResumeCtx(playerB, sessions, factions), {
      session_id: 1,
      player_slot: 'player_b',
    });
    expect(sessions[0].state).toBe(ACTIVE_SESSION_STATE);
    expect(sessions[0].turn_phase).toBe('world_update');
  });

  it('rejects unknown player slots', () => {
    const { sessions, factions } = setupSession();

    expect(() =>
      joinOrResumeSession(makeJoinResumeCtx(playerA, sessions, factions), {
        session_id: 1,
        player_slot: 'player_c',
      })
    ).toThrow(/player_slot/);
  });

  it('rejects sessions outside setup or active states', () => {
    const { sessions, factions } = setupSession();
    sessions[0] = { ...sessions[0], state: 'archived' };

    expect(() =>
      joinOrResumeSession(makeJoinResumeCtx(playerA, sessions, factions), {
        session_id: 1,
        player_slot: 'player_a',
      })
    ).toThrow(/cannot be joined or resumed/);
  });

  it('rejects claimable slots whose placeholder identity was already changed', () => {
    const { sessions, factions } = setupSession();
    factions[0] = { ...factions[0], player_id: playerC };

    expect(() =>
      joinOrResumeSession(makeJoinResumeCtx(playerA, sessions, factions), {
        session_id: 1,
        player_slot: 'player_a',
      })
    ).toThrow(/placeholder identity mismatch/);
  });

  it('registered reducer writes state without returning bootstrap payload', () => {
    const { sessions, factions } = setupSession();
    const ctx = makeJoinResumeCtx(playerA, sessions, factions);

    const result = joinOrResumeSessionReducer(ctx, {
      session_id: 1,
      player_slot: 'player_a',
    });

    expect(result).toBeUndefined();
    expect(JSON.parse(factions[0].doctrine_vector).slot.claim_status).toBe(
      'claimed'
    );
  });

  it('registers join_or_resume_session reducer in index.ts', () => {
    const src = readFileSync(srcPath('index.ts'), 'utf8');
    expect(src).toMatch(/export\s+const\s+join_or_resume_session\s*=/);
    expect(src).toContain('session_id: t.u32()');
    expect(src).toContain('player_slot: t.string()');
  });
});

describe('turn phase state machine', () => {
  function activeSession(phase: string): GameSessionRow {
    const rows = buildSessionLifecycleRows(
      { player_a_name: 'United Earth Authority', player_b_name: 'Mars Compact' },
      timestamp,
      7,
      [1, 2]
    );

    return {
      ...rows.session,
      state: ACTIVE_SESSION_STATE,
      turn_phase: phase,
      turn_deadline: timestamp,
    };
  }

  it('defines the spec turn phases and allowed transitions explicitly', () => {
    expect(TURN_PHASES).toEqual([
      'setup',
      'world_update',
      'deliberation',
      'decision',
      'resolution',
      'summary',
      'complete',
    ]);
    expect(ALLOWED_TURN_PHASE_TRANSITIONS).toEqual({
      setup: ['world_update'],
      world_update: ['deliberation'],
      deliberation: ['decision'],
      decision: ['resolution'],
      resolution: ['summary'],
      summary: ['world_update', 'complete'],
      complete: [],
    });
  });

  it('parses known phases and rejects unknown phases', () => {
    expect(parseTurnPhase('decision')).toBe('decision');
    expect(() => parseTurnPhase('combat')).toThrow(/unknown turn phase/);
  });

  it('permits the configured phase path and clears stale deadlines outside decision', () => {
    const session = activeSession('deliberation');

    const decision = transitionTurnPhase(session, 'decision', timestamp);
    expect(decision).toMatchObject({
      id: session.id,
      state: ACTIVE_SESSION_STATE,
      turn_phase: 'decision',
      turn_deadline: timestamp,
      player_a_faction_id: session.player_a_faction_id,
      player_b_faction_id: session.player_b_faction_id,
      winner_faction_id: session.winner_faction_id,
    });

    const resolution = transitionTurnPhase(decision, 'resolution', timestamp);
    expect(resolution.turn_phase).toBe('resolution');
    expect(resolution.turn_deadline).toBeUndefined();
    expect(resolution.current_turn).toBe(session.current_turn);
    expect(resolution.current_year).toBe(session.current_year);
  });

  it('rejects invalid phase jumps', () => {
    expect(() =>
      transitionTurnPhase(activeSession('world_update'), 'resolution', timestamp)
    ).toThrow(/invalid turn phase transition world_update -> resolution/);
    expect(() =>
      transitionTurnPhase(activeSession('complete'), 'world_update', timestamp)
    ).toThrow(/already complete/);
  });

  it('rejects active phase transitions before faction links are initialized', () => {
    const rows = buildSessionLifecycleRows(
      { player_a_name: 'United Earth Authority', player_b_name: 'Mars Compact' },
      timestamp,
      7
    );

    expect(() =>
      transitionTurnPhase(rows.session, 'world_update', timestamp)
    ).toThrow(/not fully initialized/);
  });

  it('advance_turn_phase reducer updates only authoritative phase state', () => {
    const sessions = [activeSession('decision')];
    const before = sessions[0];

    advanceTurnPhaseReducer(makeTurnPhaseCtx(sessions), {
      session_id: before.id,
      next_phase: 'resolution',
    });

    expect(sessions[0]).toMatchObject({
      id: before.id,
      state: before.state,
      current_year: before.current_year,
      current_turn: before.current_turn,
      player_a_faction_id: before.player_a_faction_id,
      player_b_faction_id: before.player_b_faction_id,
      winner_faction_id: before.winner_faction_id,
      turn_phase: 'resolution',
      turn_deadline: undefined,
    });
  });

  it('advance_world moves world_update sessions into deliberation without changing identity links', () => {
    const sessions = [activeSession('world_update')];
    const before = sessions[0];

    advanceWorldReducer(makeTurnPhaseCtx(sessions), { session_id: before.id });

    expect(sessions[0]).toMatchObject({
      id: before.id,
      state: before.state,
      current_year: before.current_year,
      current_turn: before.current_turn,
      player_a_faction_id: before.player_a_faction_id,
      player_b_faction_id: before.player_b_faction_id,
      winner_faction_id: before.winner_faction_id,
      turn_phase: 'deliberation',
      turn_deadline: undefined,
    });
  });

  it('advance_world rejects non-world-update phases', () => {
    const sessions = [activeSession('decision')];

    expect(() =>
      advanceWorldReducer(makeTurnPhaseCtx(sessions), { session_id: 7 })
    ).toThrow(/invalid turn phase transition decision -> deliberation/);
  });

  it('advance_world rejects setup sessions even if their phase is world_update', () => {
    const sessions = [{ ...activeSession('world_update'), state: INITIAL_SESSION_STATE }];

    expect(() =>
      advanceWorldReducer(makeTurnPhaseCtx(sessions), { session_id: 7 })
    ).toThrow(/must be active/);
  });

  it('registers phase reducers in index.ts', () => {
    const src = readFileSync(srcPath('index.ts'), 'utf8');
    expect(src).toMatch(/export\s+const\s+advance_turn_phase\s*=/);
    expect(src).toContain('next_phase: t.string()');
    expect(src).toMatch(/export\s+const\s+advance_world\s*=/);
  });
});
