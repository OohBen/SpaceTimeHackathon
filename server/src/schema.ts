import { table, t } from 'spacetimedb/server';

export const tables = {
  game_sessions: table(
    {},
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
    {},
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
    {},
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
    {},
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
    {},
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
    {},
    {
      id: t.u32().primaryKey().autoInc(),
      personnel_a_id: t.u32(),
      personnel_b_id: t.u32(),
      type: t.string(),
      strength: t.i32(),
    }
  ),

  proposals: table(
    {},
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
    {},
    {
      id: t.u32().primaryKey().autoInc(),
      faction_id: t.u32(),
      turn: t.u32(),
      from_personnel_id: t.u32(),
      subject: t.string(),
      body: t.string(),
      requires_decision: t.bool(),
      status: t.string(),
    }
  ),
};
