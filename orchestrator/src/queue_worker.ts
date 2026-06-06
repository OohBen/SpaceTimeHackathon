// Queue-drain worker logic for the LLM deliberation boundary.
//
// The SpacetimeDB module enqueues `llm_requests` rows (status=queued) when the
// session is in `queue` deliberation mode. This worker drains them: it builds a
// prompt from authoritative faction/world state, calls the live LLM, validates
// the advisory output, and writes it back via the `fulfill_deliberation`
// reducer. On any real failure it records the error via `fail_deliberation`
// (no silent fallback — the module's deterministic `fallback` mode is the only
// sanctioned degradation, and it is selected explicitly, never here).
//
// This file is intentionally free of any SpacetimeDB SDK wiring so it can be
// unit-tested with plain in-memory deps. `worker.ts` provides the live wiring.

import { buildProposalPrompt, type ProposalPromptInput } from "./proposal_prompt.js";
import { validateProposalAdvisory } from "./proposal_advisory.js";
import type { LlmTextClient } from "./openrouter_client.js";

// Mirrors server/src/llm_queue_contract.ts (kept local so the worker package is
// self-contained for containerized deployment).
export const LLM_REQUEST_TYPE = {
  proposals: "proposals",
  inbox: "inbox",
  eventNarrative: "event_narrative",
  resumeBriefing: "resume_briefing",
} as const;

export const LLM_REQUEST_STATUS = {
  queued: "queued",
  processing: "processing",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
} as const;

// NOTE: the SpacetimeDB TS SDK deserializes row columns to camelCase
// (request_type -> requestType, faction_id -> factionId, etc.), so these
// worker-facing row types use camelCase to match the live rows directly.
export type FactionRow = {
  id: number;
  name: string;
  doctrineVector: string;
};

export type CityRow = {
  factionId: number;
  name: string;
  population: number | bigint;
  morale: number;
  infrastructureLevel: number;
};

export type PersonnelRow = {
  factionId: number;
  name: string;
  department: string;
  competence: number;
  creativity: number;
  reliability: number;
  ambition: number;
  politicalSkill: number;
};

export type BodyRow = { name: string };

export type EventRow = { turn: number; eventType: string; payload: string };

export type QueueRequestRow = {
  id: number;
  factionId: number;
  sessionId: number;
  requestType: string;
  status: string;
  createdTurn: number;
};

export type WorkerDeps = {
  getFaction(factionId: number): FactionRow | undefined;
  getCitiesForFaction(factionId: number): CityRow[];
  getPersonnelForFaction(factionId: number): PersonnelRow[];
  getBodies(sessionId: number): BodyRow[];
  getRecentEvents(sessionId: number, factionId: number): EventRow[];
  llm: LlmTextClient;
  fulfill(requestId: number, itemsJson: string): void;
  fail(requestId: number, error: string, errorCode: string): void;
  log?: (message: string, fields?: Record<string, unknown>) => void;
};

const log = (deps: WorkerDeps, message: string, fields?: Record<string, unknown>): void => {
  deps.log?.(message, fields);
};

/** Process a single queued `proposals` request end to end. Never throws. */
export async function processProposalsRequest(
  request: QueueRequestRow,
  deps: WorkerDeps
): Promise<void> {
  try {
    if (request.requestType !== LLM_REQUEST_TYPE.proposals) {
      deps.fail(request.id, `unsupported request_type ${request.requestType}`, "unsupported_type");
      return;
    }

    const faction = deps.getFaction(request.factionId);
    if (!faction) {
      deps.fail(request.id, `faction ${request.factionId} not found`, "faction_missing");
      return;
    }

    const cities = deps.getCitiesForFaction(faction.id);
    const personnel = deps.getPersonnelForFaction(faction.id);
    if (cities.length === 0 || personnel.length === 0) {
      deps.fail(request.id, "no eligible cities or personnel for faction", "fallback_unavailable");
      return;
    }

    const promptInput = buildPromptInput({
      faction,
      cities,
      personnel,
      bodies: deps.getBodies(request.sessionId),
      events: deps.getRecentEvents(request.sessionId, faction.id),
    });

    const textRequest = buildProposalPrompt(promptInput);

    log(deps, "worker.llm.request", { request_id: request.id, faction_id: faction.id, turn: request.createdTurn });
    const response = await deps.llm.completeText(textRequest);

    const outcome = validateProposalAdvisory(response.content);
    if (!outcome.ok) {
      deps.fail(request.id, `advisory validation failed: ${outcome.reason}`, outcome.category);
      return;
    }

    // Advisory text only — keep just title/body. The reducer overlays these
    // onto deterministic fallback proposals, preserving authoritative numbers.
    const items = outcome.payload.proposals.map((p) => ({ title: p.title, body: p.body }));
    deps.fulfill(request.id, JSON.stringify(items));
    log(deps, "worker.fulfilled", { request_id: request.id, items: items.length });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    deps.fail(request.id, `worker error: ${message}`, "llm_error");
    log(deps, "worker.failed", { request_id: request.id, error: message });
  }
}

export function buildPromptInput(input: {
  faction: FactionRow;
  cities: CityRow[];
  personnel: PersonnelRow[];
  bodies: BodyRow[];
  events: EventRow[];
}): ProposalPromptInput {
  return {
    doctrine: parseDoctrine(input.faction.doctrineVector),
    officer: pickOfficer(input.personnel),
    world: {
      cities: input.cities.map((c) => ({
        name: c.name,
        population: Number(c.population),
        control_level: c.morale,
      })),
      bodies: input.bodies.map((b) => ({ name: b.name })),
    },
    events: input.events
      .slice(-10)
      .map((e) => ({ turn: e.turn, description: `${e.eventType}: ${truncate(e.payload, 160)}` })),
  };
}

function parseDoctrine(raw: string): ProposalPromptInput["doctrine"] {
  const fallback = { diplomacy: 50, expansion: 50, science: 50, security: 50 };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      diplomacy: numberOr(parsed.diplomacy, fallback.diplomacy),
      expansion: numberOr(parsed.expansion, fallback.expansion),
      science: numberOr(parsed.science, fallback.science),
      security: numberOr(parsed.security, fallback.security),
    };
  } catch {
    return fallback;
  }
}

function pickOfficer(personnel: PersonnelRow[]): ProposalPromptInput["officer"] {
  // Most competent officer represents the faction's deliberation voice.
  const officer = [...personnel].sort((a, b) => b.competence - a.competence)[0];
  return {
    name: officer.name,
    department: officer.department,
    traits: deriveTraits(officer),
  };
}

function deriveTraits(o: PersonnelRow): string[] {
  const traits: string[] = [];
  if (o.creativity >= 70) traits.push("creative");
  if (o.ambition >= 70) traits.push("ambitious");
  if (o.reliability >= 70) traits.push("reliable");
  if (o.politicalSkill >= 70) traits.push("politically astute");
  if (o.competence >= 70) traits.push("highly competent");
  if (traits.length === 0) traits.push("pragmatic");
  return traits;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}
