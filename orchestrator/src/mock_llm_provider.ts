import {
  LLM_MODE_PROVIDER_SCHEMA_VERSION,
  LlmModeProvider,
  LlmModeRequest,
  LlmModeResponse,
  defaultScenarioId,
  stableContextHash,
  stableJson,
} from "./llm_mode_provider.js";
import { buildFallbackNarrativePayload } from "./narrative_contract.js";

const DEPARTMENTS = ["Executive", "Industry", "Research", "Defense"] as const;
const CONFIDENCES = ["HIGH", "MEDIUM", "LOW"] as const;

export function createMockLlmModeProvider(): LlmModeProvider {
  return {
    mode: "mock",
    async completeRequest(request: LlmModeRequest): Promise<LlmModeResponse> {
      return buildMockResponse(request);
    },
  };
}

export function buildMockResponse(request: LlmModeRequest): LlmModeResponse {
  const scenarioId = defaultScenarioId(request);
  const seed = stableContextHash({
    context: request.context,
    faction_id: request.faction_id,
    request_type: request.request_type,
    scenario_id: scenarioId,
    session_id: request.session_id,
    turn: request.turn,
  });

  const responseJson = stableJson(buildResponsePayload(request, seed));

  return {
    faction_id: request.faction_id,
    request_type: request.request_type,
    response_json: responseJson,
    schema_version: LLM_MODE_PROVIDER_SCHEMA_VERSION,
    scenario_id: scenarioId,
    session_id: request.session_id,
    source: "mock",
    turn: request.turn,
  };
}

function buildResponsePayload(request: LlmModeRequest, seed: number): unknown {
  switch (request.request_type) {
    case "proposals":
      return buildMockProposals(request, seed);
    case "inbox":
      return buildFallbackNarrativePayload(request, "mock");
    case "event_narrative":
      return buildFallbackNarrativePayload(request, "mock");
    case "resume_briefing":
      return buildFallbackNarrativePayload(request, "mock");
  }
}

function buildMockProposals(request: LlmModeRequest, seed: number): unknown {
  const count = 2 + (seed % 2);
  const proposals = Array.from({ length: count }, (_, index) => {
    const slot = pickIndex(seed, index, DEPARTMENTS.length);
    const department = DEPARTMENTS[slot];
    const cost = 80 + ((seed + index * 37) % 220);
    const confidence = CONFIDENCES[pickIndex(seed, index + 7, CONFIDENCES.length)];
    return {
      body: [
        `Mock ${department} brief for faction ${request.faction_id}`,
        `on turn ${request.turn}.`,
        `Recommendation: ${department.toLowerCase()} surge with milestone reporting.`,
        `Confidence: ${confidence}. Cost: ${cost} credits.`,
      ].join(" "),
      confidence,
      department,
      resource_cost: cost,
      title: `${department} Initiative ${index + 1} (Turn ${request.turn})`,
    };
  });

  return {
    proposals,
    schema_version: 1,
  };
}

function pickIndex(seed: number, offset: number, length: number): number {
  const mixed = (seed + offset * 2654435761) >>> 0;
  return mixed % length;
}
