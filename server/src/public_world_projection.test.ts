import { describe, expect, it } from 'vitest';

import { TABLE_ACCESS_POLICIES } from './access_policy.js';
import { turn1Seed, type Turn1SeedRows } from './turn1_seed.js';
import { turn8Seed } from './turn8_seed.js';

type ProjectionRows = Record<string, unknown>[];

interface PublicWorldProjection {
  game_sessions: ProjectionRows;
  celestial_bodies: ProjectionRows;
  factions: ProjectionRows;
  cities: ProjectionRows;
  fleets: ProjectionRows;
  colony_ships: ProjectionRows;
  events: ProjectionRows;
}

interface PublicWorldProjectionModule {
  PUBLIC_WORLD_PRIVATE_FIELD_DENYLIST: readonly string[];
  PUBLIC_WORLD_SUBSCRIPTION_GROUPS: {
    shared_full: readonly string[];
    public_projections: readonly {
      sourceTable: string;
      viewName: string;
      fields: readonly string[];
    }[];
  };
  buildPublicWorldProjection: (
    rows: Turn1SeedRows,
    input?: { sessionId?: number; viewerFactionId?: number }
  ) => PublicWorldProjection;
}

const sorted = (values: readonly string[]): string[] => [...values].sort();

const rowKeys = (row: Record<string, unknown>): string[] =>
  Object.keys(row).sort();

const loadProjectionModule =
  async (): Promise<PublicWorldProjectionModule> => {
    let importError: unknown;
    const module = await import('./public_world_projection.js').catch(
      (error: unknown) => {
        importError = error;
        return undefined;
      }
    );

    expect(
      module,
      `server/src/public_world_projection.ts should expose public projection builders; import error: ${String(importError)}`
    ).toBeDefined();

    return module as unknown as PublicWorldProjectionModule;
  };

describe('public world projection contract', () => {
  it('defines the shared and projected subscriptions both factions may use', async () => {
    const { PUBLIC_WORLD_SUBSCRIPTION_GROUPS } = await loadProjectionModule();

    expect(PUBLIC_WORLD_SUBSCRIPTION_GROUPS.shared_full).toEqual([
      'game_sessions',
      'celestial_bodies',
    ]);
    expect(
      PUBLIC_WORLD_SUBSCRIPTION_GROUPS.public_projections.map(
        (projection) => projection.sourceTable
      )
    ).toEqual(['factions', 'cities', 'fleets', 'colony_ships', 'events']);
    expect(
      PUBLIC_WORLD_SUBSCRIPTION_GROUPS.public_projections.map(
        (projection) => projection.viewName
      )
    ).toEqual([
      'public_factions',
      'public_cities',
      'public_fleets',
      'public_colony_ships',
      'public_events',
    ]);
  });

  it('returns the same public world rows for either faction viewer', async () => {
    const { buildPublicWorldProjection } = await loadProjectionModule();

    const playerAView = buildPublicWorldProjection(turn8Seed, {
      sessionId: 1,
      viewerFactionId: 1,
    });
    const playerBView = buildPublicWorldProjection(turn8Seed, {
      sessionId: 1,
      viewerFactionId: 2,
    });

    expect(playerAView).toEqual(playerBView);
    expect(playerAView.celestial_bodies).toHaveLength(
      turn8Seed.celestial_bodies.length
    );
    expect(playerAView.cities).toHaveLength(turn8Seed.cities.length);
  });

  it('uses access-policy public fields and omits faction-private data', async () => {
    const {
      PUBLIC_WORLD_PRIVATE_FIELD_DENYLIST,
      buildPublicWorldProjection,
    } = await loadProjectionModule();
    const projection = buildPublicWorldProjection(turn1Seed);

    expect(rowKeys(projection.factions[0])).toEqual(
      sorted(TABLE_ACCESS_POLICIES.factions.publicProjection ?? [])
    );
    expect(rowKeys(projection.cities[0])).toEqual(
      sorted(TABLE_ACCESS_POLICIES.cities.publicProjection ?? [])
    );
    expect(rowKeys(projection.fleets[0])).toEqual(
      sorted(TABLE_ACCESS_POLICIES.fleets.publicProjection ?? [])
    );
    expect(rowKeys(projection.events[0])).toEqual(
      sorted(TABLE_ACCESS_POLICIES.events.publicProjection ?? [])
    );

    for (const rows of Object.values(projection)) {
      for (const row of rows) {
        expect(
          rowKeys(row).filter((key) =>
            PUBLIC_WORLD_PRIVATE_FIELD_DENYLIST.includes(key)
          )
        ).toEqual([]);
      }
    }
  });

  it('keeps map rows practical for frontend joins and travel state', async () => {
    const { buildPublicWorldProjection } = await loadProjectionModule();
    const projection = buildPublicWorldProjection(turn8Seed);

    expect(projection.cities[0]).toEqual({
      body_id: turn8Seed.cities[0].body_id,
      development_stage: turn8Seed.cities[0].development_stage,
      faction_id: turn8Seed.cities[0].faction_id,
      id: turn8Seed.cities[0].id,
      name: turn8Seed.cities[0].name,
      session_id: turn8Seed.cities[0].session_id,
    });
    expect(projection.fleets[0]).toEqual({
      faction_id: turn8Seed.fleets[0].faction_id,
      id: turn8Seed.fleets[0].id,
      posting_city_id: turn8Seed.fleets[0].posting_city_id,
      strength: turn8Seed.fleets[0].strength,
    });
    expect(projection.colony_ships[0]).toEqual({
      arrives_turn: turn8Seed.colony_ships[0].arrives_turn,
      destination_body_id: turn8Seed.colony_ships[0].destination_body_id,
      faction_id: turn8Seed.colony_ships[0].faction_id,
      id: turn8Seed.colony_ships[0].id,
      status: turn8Seed.colony_ships[0].status,
    });
  });
});
