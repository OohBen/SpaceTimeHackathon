import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Identity, Timestamp } from 'spacetimedb';
import { describe, expect, it } from 'vitest';
import {
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
  type CreateSessionInput,
  type FactionRow,
  type GameSessionRow,
  type JoinOrResumeContext,
  type SessionLifecycleContext,
} from './session_lifecycle.js';

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
    expect(sessions[0].state).toBe('active');
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
