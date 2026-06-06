import { table, t } from 'spacetimedb/server';

export const tables = {
  game_sessions: table(
    {
      public: true,
      indexes: [
        { accessor: 'game_sessions_state_idx', algorithm: 'btree', columns: ['state'] as const },
      ],
    },
    {
      id: t.u32().primaryKey().autoInc(),
      state: t.string(),
      current_year: t.u32(),
      current_turn: t.u32(),
      player_a_faction_id: t.option(t.u32()),
      player_b_faction_id: t.option(t.u32()),
      turn_phase: t.string(),
      turn_deadline: t.option(t.timestamp()),
      winner_faction_id: t.option(t.u32()),
      created_at: t.timestamp(),
      updated_at: t.timestamp(),
    }
  ),

  factions: table(
    {
      public: true,
      indexes: [
        { accessor: 'factions_session_idx', algorithm: 'btree', columns: ['session_id'] as const },
        { accessor: 'factions_player_idx', algorithm: 'btree', columns: ['player_id'] as const },
      ],
      constraints: [
        { constraint: 'unique', columns: ['player_id'] as const },
      ],
    },
    {
      id: t.u32().primaryKey().autoInc(),
      session_id: t.u32(),
      player_id: t.identity(),
      name: t.string(),
      credits: t.i32(),
      political_capital: t.i32(),
      doctrine_vector: t.string(),
      control_score: t.i32(),
      ready_for_turn: t.bool(),
    }
  ),

  celestial_bodies: table(
    { public: true },
    {
      id: t.u32().primaryKey().autoInc(),
      session_id: t.u32(),
      name: t.string(),
      system_tier: t.string(),
      comms_lag_turns: t.u32(),
      travel_time_turns: t.u32(),
      resource_deposits: t.string(),
      position: t.string(),
    }
  ),

  cities: table(
    {
      public: true,
      indexes: [
        { accessor: 'cities_body_idx', algorithm: 'btree', columns: ['body_id'] as const },
        { accessor: 'cities_faction_idx', algorithm: 'btree', columns: ['faction_id'] as const },
      ],
    },
    {
      id: t.u32().primaryKey().autoInc(),
      session_id: t.u32(),
      body_id: t.u32(),
      faction_id: t.u32(),
      name: t.string(),
      population: t.u64(),
      infrastructure_level: t.u32(),
      morale: t.u32(),
      industrial_output: t.i32(),
      research_output: t.i32(),
      garrison_strength: t.i32(),
      supply_status: t.string(),
      development_stage: t.string(),
    }
  ),

  personnel: table(
    {
      public: true,
      indexes: [
        { accessor: 'personnel_faction_idx', algorithm: 'btree', columns: ['faction_id'] as const },
      ],
    },
    {
      id: t.u32().primaryKey().autoInc(),
      faction_id: t.u32(),
      name: t.string(),
      role: t.string(),
      department: t.string(),
      posting_city_id: t.option(t.u32()),
      competence: t.u32(),
      creativity: t.u32(),
      reliability: t.u32(),
      ambition: t.u32(),
      political_skill: t.u32(),
      communication: t.u32(),
      loyalty: t.u32(),
      autonomy_tolerance: t.u32(),
      morale: t.u32(),
      burnout: t.u32(),
      salary: t.i32(),
    }
  ),

  personnel_relationships: table(
    { public: true },
    {
      id: t.u32().primaryKey().autoInc(),
      personnel_a_id: t.u32(),
      personnel_b_id: t.u32(),
      type: t.string(),
      strength: t.i32(),
    }
  ),

  proposals: table(
    {
      public: true,
      indexes: [
        { accessor: 'proposals_faction_idx', algorithm: 'btree', columns: ['faction_id', 'turn'] as const },
      ],
    },
    {
      id: t.u32().primaryKey().autoInc(),
      faction_id: t.u32(),
      turn: t.u32(),
      proposing_personnel_id: t.u32(),
      department: t.string(),
      title: t.string(),
      body: t.string(),
      resource_cost: t.i32(),
      confidence: t.string(),
      status: t.string(),
      decision: t.option(t.string()),
    }
  ),

  commander_inbox: table(
    { public: true },
    {
      id: t.u32().primaryKey().autoInc(),
      faction_id: t.u32(),
      turn: t.u32(),
      from_personnel_id: t.u32(),
      subject: t.string(),
      body: t.string(),
      narrative_json: t.option(t.string()),
      requires_decision: t.bool(),
      status: t.string(),
    }
  ),

  fleets: table(
    { public: true },
    {
      id: t.u32().primaryKey().autoInc(),
      faction_id: t.u32(),
      posting_city_id: t.u32(),
      strength: t.i32(),
      orders: t.option(t.string()),
    }
  ),

  colony_ships: table(
    { public: true },
    {
      id: t.u32().primaryKey().autoInc(),
      faction_id: t.u32(),
      origin_city_id: t.u32(),
      destination_body_id: t.u32(),
      manifest: t.string(),
      departed_turn: t.u32(),
      arrives_turn: t.u32(),
      status: t.string(),
    }
  ),

  projects: table(
    { public: true },
    {
      id: t.u32().primaryKey().autoInc(),
      faction_id: t.u32(),
      city_id: t.u32(),
      type: t.string(),
      name: t.string(),
      progress: t.i32(),
      resources_assigned: t.i32(),
      est_completion: t.u32(),
      status: t.string(),
    }
  ),

  intelligence_records: table(
    { public: true },
    {
      id: t.u32().primaryKey().autoInc(),
      observer_faction_id: t.u32(),
      target_faction_id: t.u32(),
      intel_type: t.string(),
      value: t.string(),
      accuracy: t.i32(),
      acquired_turn: t.u32(),
    }
  ),

  events: table(
    { public: true },
    {
      id: t.u32().primaryKey().autoInc(),
      session_id: t.u32(),
      faction_id: t.option(t.u32()),
      turn: t.u32(),
      event_type: t.string(),
      payload: t.string(),
      narrative_json: t.option(t.string()),
    }
  ),

  turn_summaries: table(
    {
      public: true,
      indexes: [
        { accessor: 'turn_summaries_session_idx', algorithm: 'btree', columns: ['session_id', 'turn'] as const },
        { accessor: 'turn_summaries_faction_idx', algorithm: 'btree', columns: ['faction_id', 'turn'] as const },
      ],
    },
    {
      id: t.u32().primaryKey().autoInc(),
      session_id: t.u32(),
      faction_id: t.u32(),
      turn: t.u32(),
      summary_json: t.string(),
      narrative_json: t.option(t.string()),
      acknowledged: t.bool(),
      acknowledged_at: t.option(t.timestamp()),
      created_at: t.timestamp(),
      updated_at: t.timestamp(),
    }
  ),

  trade_agreements: table(
    { public: true },
    {
      id: t.u32().primaryKey().autoInc(),
      session_id: t.u32(),
      faction_a_id: t.u32(),
      faction_b_id: t.u32(),
      terms: t.string(),
      signed_turn: t.u32(),
      expires_turn: t.option(t.u32()),
    }
  ),

  llm_requests: table(
    {
      public: true,
      indexes: [
        { accessor: 'llm_status_idx', algorithm: 'btree', columns: ['status'] as const },
        { accessor: 'llm_session_turn_idx', algorithm: 'btree', columns: ['session_id', 'faction_id', 'created_turn'] as const },
      ],
    },
    {
      id: t.u32().primaryKey().autoInc(),
      session_id: t.u32(),
      faction_id: t.u32(),
      request_type: t.string(),
      context_json: t.string(),
      status: t.string(),
      response_json: t.option(t.string()),
      error: t.option(t.string()),
      error_code: t.option(t.string()),
      attempt_count: t.u32(),
      created_turn: t.u32(),
      updated_turn: t.u32(),
    }
  ),

  module_settings: table(
    { public: true },
    {
      id: t.u32().primaryKey(),
      deliberation_mode: t.string(),
    }
  ),
};
