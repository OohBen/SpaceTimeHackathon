import type { LlmTextRequest } from "./openrouter_client.js";
import type { LlmModeRequest, LlmRequestType } from "./llm_mode_provider.js";
import { stableJson } from "./llm_mode_provider.js";

export const NARRATIVE_REQUEST_TYPES = [
  "inbox",
  "event_narrative",
  "resume_briefing",
] as const;

export type NarrativeRequestType = (typeof NARRATIVE_REQUEST_TYPES)[number];

export const NARRATIVE_PAYLOAD_SCHEMA_VERSION = 1;

export const NARRATIVE_CONTENT_LIMITS = {
  maxContextArrayItems: 5,
  maxContextDepth: 4,
  maxContextEntries: 12,
  maxContextStringChars: 180,
  maxHeadlineChars: 96,
  maxOutputTokens: 480,
  maxPromptChars: 3_800,
  maxProseChars: 640,
} as const;

export type NarrativeSurface =
  | "briefing"
  | "command_center"
  | "inbox"
  | "resolution"
  | "resume"
  | "turn_resolution";

export type NarrativeSource = "fallback" | "fixture" | "live" | "mock";

export type NarrativeContractRole =
  | "advisory_proposal_candidates"
  | "display_narrative";

export type NarrativeRequestContract = {
  authoritative: false;
  displayOnly: boolean;
  fallbackRequired: boolean;
  privacyScope: "own_faction";
  role: NarrativeContractRole;
  surfaces: readonly NarrativeSurface[];
};

export const NARRATIVE_REQUEST_CONTRACTS = {
  proposals: {
    authoritative: false,
    displayOnly: false,
    fallbackRequired: true,
    privacyScope: "own_faction",
    role: "advisory_proposal_candidates",
    surfaces: ["inbox", "command_center"],
  },
  inbox: {
    authoritative: false,
    displayOnly: true,
    fallbackRequired: true,
    privacyScope: "own_faction",
    role: "display_narrative",
    surfaces: ["inbox", "briefing", "command_center"],
  },
  event_narrative: {
    authoritative: false,
    displayOnly: true,
    fallbackRequired: true,
    privacyScope: "own_faction",
    role: "display_narrative",
    surfaces: ["resolution", "turn_resolution"],
  },
  resume_briefing: {
    authoritative: false,
    displayOnly: true,
    fallbackRequired: true,
    privacyScope: "own_faction",
    role: "display_narrative",
    surfaces: ["resume", "briefing"],
  },
} as const satisfies Record<LlmRequestType, NarrativeRequestContract>;

export type NarrativePayloadMetadata = {
  faction_id: number;
  privacy_scope: "own_faction";
  session_id: number;
  turn: number;
};

export type NarrativePayload = {
  authoritative: false;
  display_only: true;
  headline: string;
  metadata: NarrativePayloadMetadata;
  prose: string;
  request_type: NarrativeRequestType;
  schema_version: typeof NARRATIVE_PAYLOAD_SCHEMA_VERSION;
  source: NarrativeSource;
  surface: NarrativeSurface;
};

export type NarrativeValidationSuccess = {
  ok: true;
  payload: NarrativePayload;
};

export type NarrativeValidationFailure = {
  code: string;
  message: string;
  ok: false;
};

export type NarrativeValidationOutcome =
  | NarrativeValidationFailure
  | NarrativeValidationSuccess;

const FORBIDDEN_AUTHORITATIVE_KEYS = new Set([
  "authoritative_state",
  "control_scores",
  "decision",
  "proposal_ids",
  "resource_delta",
  "simulation_outputs",
  "state_patch",
  "winner_faction_id",
]);

export function buildNarrativePrompt(request: LlmModeRequest): LlmTextRequest {
  const requestType = assertNarrativeRequestType(request.request_type);
  const contract = NARRATIVE_REQUEST_CONTRACTS[requestType];
  const context = boundedContext(request.context);
  const surface = readSurface(request.context, contract.surfaces[0]);
  const schema = {
    authoritative: false,
    display_only: true,
    headline: `string <= ${NARRATIVE_CONTENT_LIMITS.maxHeadlineChars} chars`,
    metadata: {
      faction_id: request.faction_id,
      privacy_scope: contract.privacyScope,
      session_id: request.session_id,
      turn: request.turn,
    },
    prose: `string <= ${NARRATIVE_CONTENT_LIMITS.maxProseChars} chars`,
    request_type: requestType,
    schema_version: NARRATIVE_PAYLOAD_SCHEMA_VERSION,
    source: "live",
    surface,
  };
  const body = [
    `Request type: ${requestType}`,
    `Surface: ${surface}`,
    `Faction: ${request.faction_id}`,
    `Session: ${request.session_id}`,
    `Turn: ${request.turn}`,
    "",
    "Return JSON matching this display-only schema:",
    stableJson(schema),
    "",
    "Bounded context:",
    stableJson(context),
  ].join("\n");

  return {
    maxTokens: NARRATIVE_CONTENT_LIMITS.maxOutputTokens,
    prompt: truncate(body, NARRATIVE_CONTENT_LIMITS.maxPromptChars),
    responseFormat: "json_object",
    system: [
      "You write Solar Dominion narrative prose.",
      "Output is display-only and informational.",
      "Never claim to update authoritative simulation state.",
      "Never include state_patch, resource_delta, winner_faction_id, decisions, or control_scores.",
      "Respect own-faction privacy; do not reveal opponent-private data.",
    ].join(" "),
    temperature: 0.4,
  };
}

export function buildFallbackNarrativePayload(
  request: LlmModeRequest,
  source: NarrativeSource = "fallback"
): NarrativePayload {
  const requestType = assertNarrativeRequestType(request.request_type);
  const contract = NARRATIVE_REQUEST_CONTRACTS[requestType];
  const factionName = readContextString(request.context, "faction_name")
    ?? `Faction ${request.faction_id}`;
  const surface = readSurface(request.context, contract.surfaces[0]);
  const headline = fallbackHeadline(requestType, request.turn);

  return {
    authoritative: false,
    display_only: true,
    headline,
    metadata: {
      faction_id: request.faction_id,
      privacy_scope: "own_faction",
      session_id: request.session_id,
      turn: request.turn,
    },
    prose: fallbackProse(requestType, factionName, request.turn),
    request_type: requestType,
    schema_version: NARRATIVE_PAYLOAD_SCHEMA_VERSION,
    source,
    surface,
  };
}

export function validateNarrativePayload(
  content: string,
  expectedType: NarrativeRequestType
): NarrativeValidationOutcome {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return fail("invalid_json", "narrative payload must be valid JSON");
  }

  if (!isRecord(parsed)) {
    return fail("payload_invalid", "narrative payload must be a JSON object");
  }
  if (hasForbiddenAuthoritativeKeys(parsed) || parsed.authoritative !== false) {
    return fail(
      "authoritative_field_forbidden",
      "narrative payload must not contain authoritative state"
    );
  }
  if (parsed.display_only !== true) {
    return fail("display_only_required", "narrative payload must be display-only");
  }
  if (parsed.schema_version !== NARRATIVE_PAYLOAD_SCHEMA_VERSION) {
    return fail("schema_version_invalid", "narrative schema_version mismatch");
  }
  if (parsed.request_type !== expectedType) {
    return fail("request_type_mismatch", "narrative request_type mismatch");
  }
  if (!isNarrativeSource(parsed.source)) {
    return fail("source_invalid", "narrative source invalid");
  }
  if (!isNarrativeSurface(parsed.surface)) {
    return fail("surface_invalid", "narrative surface invalid");
  }
  const headline = readBoundedString(
    parsed.headline,
    "headline",
    NARRATIVE_CONTENT_LIMITS.maxHeadlineChars
  );
  if (!headline.ok) return headline;
  const prose = readBoundedString(
    parsed.prose,
    "prose",
    NARRATIVE_CONTENT_LIMITS.maxProseChars
  );
  if (!prose.ok) return prose;
  const metadata = validateMetadata(parsed.metadata);
  if (!metadata.ok) return metadata;

  return {
    ok: true,
    payload: {
      authoritative: false,
      display_only: true,
      headline: headline.value,
      metadata: metadata.value,
      prose: prose.value,
      request_type: expectedType,
      schema_version: NARRATIVE_PAYLOAD_SCHEMA_VERSION,
      source: parsed.source,
      surface: parsed.surface,
    },
  };
}

function assertNarrativeRequestType(value: string): NarrativeRequestType {
  if (NARRATIVE_REQUEST_TYPES.includes(value as NarrativeRequestType)) {
    return value as NarrativeRequestType;
  }
  throw new Error(`narrative request_type unsupported: ${value}`);
}

function fallbackHeadline(requestType: NarrativeRequestType, turn: number): string {
  switch (requestType) {
    case "inbox":
      return `Turn ${turn} command briefing`;
    case "event_narrative":
      return `Turn ${turn} resolution pulse`;
    case "resume_briefing":
      return `Turn ${turn} resume briefing`;
  }
}

function fallbackProse(
  requestType: NarrativeRequestType,
  factionName: string,
  turn: number
): string {
  switch (requestType) {
    case "inbox":
      return truncate(
        `${factionName} command staff flags routine updates for turn ${turn}. Review private notices and proposal context before committing orders.`,
        NARRATIVE_CONTENT_LIMITS.maxProseChars
      );
    case "event_narrative":
      return truncate(
        `${factionName} receives a turn ${turn} resolution note. Treat this as flavor text only; authoritative outcomes remain in simulation records.`,
        NARRATIVE_CONTENT_LIMITS.maxProseChars
      );
    case "resume_briefing":
      return truncate(
        `${factionName} resumes on turn ${turn}. Pending command context is summarized for orientation without changing game state.`,
        NARRATIVE_CONTENT_LIMITS.maxProseChars
      );
  }
}

function boundedContext(value: unknown, depth = 0): unknown {
  if (depth >= NARRATIVE_CONTENT_LIMITS.maxContextDepth) {
    return "[bounded]";
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, NARRATIVE_CONTENT_LIMITS.maxContextArrayItems)
      .map(entry => boundedContext(entry, depth + 1));
  }
  if (typeof value === "string") {
    return truncate(value, NARRATIVE_CONTENT_LIMITS.maxContextStringChars);
  }
  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !FORBIDDEN_AUTHORITATIVE_KEYS.has(key))
      .slice(0, NARRATIVE_CONTENT_LIMITS.maxContextEntries)
      .map(([key, entry]) => [key, boundedContext(entry, depth + 1)])
  );
}

function readSurface(value: unknown, fallback: NarrativeSurface): NarrativeSurface {
  const surface = readContextString(value, "surface");
  return surface && isNarrativeSurface(surface) ? surface : fallback;
}

function readContextString(value: unknown, key: string): string | null {
  if (!isRecord(value)) return null;
  const entry = value[key];
  return typeof entry === "string" && entry.trim() ? entry.trim() : null;
}

function validateMetadata(value: unknown):
  | { ok: true; value: NarrativePayloadMetadata }
  | NarrativeValidationFailure {
  if (!isRecord(value)) {
    return fail("metadata_invalid", "narrative metadata must be an object");
  }
  if (value.privacy_scope !== "own_faction") {
    return fail("privacy_scope_invalid", "narrative privacy_scope must be own_faction");
  }
  const factionId = readInteger(value.faction_id);
  const sessionId = readInteger(value.session_id);
  const turn = readInteger(value.turn);
  if (factionId === null || sessionId === null || turn === null) {
    return fail("metadata_invalid", "narrative metadata ids must be integers");
  }
  return {
    ok: true,
    value: {
      faction_id: factionId,
      privacy_scope: "own_faction",
      session_id: sessionId,
      turn,
    },
  };
}

function readBoundedString(value: unknown, key: string, max: number):
  | { ok: true; value: string }
  | NarrativeValidationFailure {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(`${key}_invalid`, `narrative ${key} must be a non-empty string`);
  }
  if (value.length > max) {
    return fail(`${key}_too_long`, `narrative ${key} exceeds ${max} chars`);
  }
  return { ok: true, value };
}

function hasForbiddenAuthoritativeKeys(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(hasForbiddenAuthoritativeKeys);
  }
  if (!isRecord(value)) {
    return false;
  }
  return Object.entries(value).some(
    ([key, entry]) =>
      FORBIDDEN_AUTHORITATIVE_KEYS.has(key) ||
      hasForbiddenAuthoritativeKeys(entry)
  );
}

function isNarrativeSource(value: unknown): value is NarrativeSource {
  return value === "fallback" || value === "fixture" || value === "live" || value === "mock";
}

function isNarrativeSurface(value: unknown): value is NarrativeSurface {
  return (
    value === "briefing" ||
    value === "command_center" ||
    value === "inbox" ||
    value === "resolution" ||
    value === "resume" ||
    value === "turn_resolution"
  );
}

function readInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

function fail(code: string, message: string): NarrativeValidationFailure {
  return { code, message, ok: false };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
