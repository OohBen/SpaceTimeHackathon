import type { LlmTextRequest } from "./openrouter_client.js";

export type FactionDoctrine = {
  diplomacy: number;
  expansion: number;
  science: number;
  security: number;
};

export type OfficerTraits = {
  department: string;
  name: string;
  traits: string[];
};

export type CityState = {
  control_level: number;
  name: string;
  population: number;
};

export type BodyState = {
  name: string;
};

export type IntelSummary = {
  faction: string;
  report: string;
};

export type RecentEvent = {
  description: string;
  turn: number;
};

export type OutstandingRequest = {
  department: string;
  request: string;
};

/**
 * Input for the proposal prompt builder.
 *
 * PRIVACY BOUNDARY: The orchestrator assumes this context has already
 * been filtered by the game server. It must not contain opposing faction
 * private data. Omissions (e.g. lack of intel or events) are explicitly
 * represented as "None" in the prompt to ensure the LLM understands
 * the absence of information.
 */
export type ProposalPromptInput = {
  doctrine: FactionDoctrine;
  events?: RecentEvent[];
  intel?: IntelSummary[];
  officer: OfficerTraits;
  requests?: OutstandingRequest[];
  world: {
    bodies: BodyState[];
    cities: CityState[];
  };
};

export const PROPOSAL_PROMPT_LIMITS = {
  maxEvents: 10,
  maxIntel: 5,
  maxRequests: 5,
  maxPromptChars: 12_000,
} as const;

const COMPARE_LOCALE = "en";

function formatDoctrine(doctrine: FactionDoctrine): string {
  return [
    `Diplomacy: ${doctrine.diplomacy.toFixed(2)}`,
    `Expansion: ${doctrine.expansion.toFixed(2)}`,
    `Science: ${doctrine.science.toFixed(2)}`,
    `Security: ${doctrine.security.toFixed(2)}`,
  ].join("\n");
}

function formatOfficer(officer: OfficerTraits): string {
  const traits = [...officer.traits]
    .sort((a, b) => a.localeCompare(b, COMPARE_LOCALE))
    .join(", ");
  return `Name: ${officer.name}\nDepartment: ${officer.department}\nTraits: ${traits}`;
}

function formatWorld(world: ProposalPromptInput["world"]): string {
  const cities = [...world.cities]
    .sort((a, b) => a.name.localeCompare(b.name, COMPARE_LOCALE))
    .map(c => `- ${c.name} (Pop: ${c.population}, Control: ${c.control_level.toFixed(2)})`)
    .join("\n");

  const bodies = [...world.bodies]
    .sort((a, b) => a.name.localeCompare(b.name, COMPARE_LOCALE))
    .map(b => `- ${b.name}`)
    .join("\n");

  return `Cities:\n${cities || "None"}\nBodies:\n${bodies || "None"}`;
}

function formatEvents(events?: RecentEvent[]): string {
  if (!events || events.length === 0) return "None";
  return [...events]
    .sort(
      (a, b) =>
        b.turn - a.turn || a.description.localeCompare(b.description, COMPARE_LOCALE)
    )
    .slice(0, PROPOSAL_PROMPT_LIMITS.maxEvents)
    .map(e => `Turn ${e.turn}: ${e.description}`)
    .join("\n");
}

function formatIntel(intel?: IntelSummary[]): string {
  if (!intel || intel.length === 0) return "None";
  return [...intel]
    .sort((a, b) => a.faction.localeCompare(b.faction, COMPARE_LOCALE))
    .slice(0, PROPOSAL_PROMPT_LIMITS.maxIntel)
    .map(i => `[${i.faction}] ${i.report}`)
    .join("\n");
}

function formatRequests(requests?: OutstandingRequest[]): string {
  if (!requests || requests.length === 0) return "None";
  return [...requests]
    .sort(
      (a, b) =>
        a.department.localeCompare(b.department, COMPARE_LOCALE) ||
        a.request.localeCompare(b.request, COMPARE_LOCALE)
    )
    .slice(0, PROPOSAL_PROMPT_LIMITS.maxRequests)
    .map(r => `From ${r.department}: ${r.request}`)
    .join("\n");
}

/**
 * Builds a deterministic LLM text request from the given game state.
 *
 * Normalization rules:
 * - Missing arrays are represented as "None".
 * - Lists are sorted deterministically by name, turn, or department to
 *   avoid accidental nondeterminism from DB query order.
 * - Array lengths are strictly bounded to prevent context window overflow.
 */
export function buildProposalPrompt(input: ProposalPromptInput): LlmTextRequest {
  const system = `You are a commanding officer in a sci-fi strategy game. You must propose a course of action based on your faction's doctrine, your personal traits, and the current state of the solar system. You must return exactly ONE JSON object containing a "proposals" array with your suggested actions. Do not output any other text or markdown.

Each proposal must have:
- title: string (short summary)
- body: string (detailed justification)
- department: string (your department)
- confidence: "HIGH" | "MEDIUM" | "LOW"
- resource_cost: number (estimated cost)`;

  const prompt = `--- OFFICER PROFILE ---
${formatOfficer(input.officer)}

--- FACTION DOCTRINE ---
${formatDoctrine(input.doctrine)}

--- WORLD STATE ---
${formatWorld(input.world)}

--- RECENT EVENTS ---
${formatEvents(input.events)}

--- INTELLIGENCE ---
${formatIntel(input.intel)}

--- OUTSTANDING REQUESTS ---
${formatRequests(input.requests)}

Based on the above context, provide your proposals.`;

  return { prompt, system };
}
