import { describe, expect, it } from "vitest";

import type { LlmModeRequest } from "./llm_mode_provider.js";
import { LLM_REQUEST_TYPES } from "./llm_mode_provider.js";
import {
  NARRATIVE_CONTENT_LIMITS,
  NARRATIVE_REQUEST_CONTRACTS,
  NARRATIVE_REQUEST_TYPES,
  buildFallbackNarrativePayload,
  buildNarrativePrompt,
  validateNarrativePayload,
} from "./narrative_contract.js";

const baseRequest = (
  requestType: (typeof NARRATIVE_REQUEST_TYPES)[number],
  context: Record<string, unknown> = {}
): LlmModeRequest => ({
  context: {
    faction_name: "Earth Directorate",
    surface: "command_center",
    ...context,
  },
  faction_id: 2,
  request_type: requestType,
  session_id: 7,
  turn: 4,
});

describe("narrative request contract", () => {
  it("covers every request type named by the shared LLM mode boundary", () => {
    expect(Object.keys(NARRATIVE_REQUEST_CONTRACTS)).toEqual([...LLM_REQUEST_TYPES]);
    expect(NARRATIVE_REQUEST_CONTRACTS.proposals.role).toBe(
      "advisory_proposal_candidates"
    );

    for (const requestType of NARRATIVE_REQUEST_TYPES) {
      const contract = NARRATIVE_REQUEST_CONTRACTS[requestType];
      expect(contract.authoritative).toBe(false);
      expect(contract.displayOnly).toBe(true);
      expect(contract.fallbackRequired).toBe(true);
      expect(contract.privacyScope).toBe("own_faction");
    }
  });

  it("builds bounded prompts that ask for display-only prose", () => {
    const prompt = buildNarrativePrompt(
      baseRequest("inbox", {
        events: Array.from({ length: 8 }, (_, index) => ({
          detail: `event-${index}-${"x".repeat(200)}`,
          turn: index + 1,
        })),
        state_patch: { credits: 9999 },
      })
    );

    expect(prompt.responseFormat).toBe("json_object");
    expect(prompt.maxTokens).toBeLessThanOrEqual(
      NARRATIVE_CONTENT_LIMITS.maxOutputTokens
    );
    expect(prompt.system).toContain("display-only");
    expect(prompt.system).toContain("authoritative");
    expect(prompt.prompt.length).toBeLessThanOrEqual(
      NARRATIVE_CONTENT_LIMITS.maxPromptChars
    );
    expect(prompt.prompt).not.toContain("state_patch");
  });

  it("generates deterministic fallback payloads for every narrative request type", () => {
    for (const requestType of NARRATIVE_REQUEST_TYPES) {
      const request = baseRequest(requestType, { surface: "resolution" });
      const first = buildFallbackNarrativePayload(request);
      const second = buildFallbackNarrativePayload(request);

      expect(second).toEqual(first);
      expect(first).toMatchObject({
        authoritative: false,
        display_only: true,
        metadata: {
          faction_id: 2,
          privacy_scope: "own_faction",
          session_id: 7,
          turn: 4,
        },
        request_type: requestType,
        schema_version: 1,
        source: "fallback",
      });
      expect(first.prose.length).toBeLessThanOrEqual(
        NARRATIVE_CONTENT_LIMITS.maxProseChars
      );

      const validation = validateNarrativePayload(
        JSON.stringify(first),
        requestType
      );
      expect(validation.ok).toBe(true);
    }
  });

  it("rejects narrative payloads that try to alter authoritative state", () => {
    const fallback = buildFallbackNarrativePayload(baseRequest("event_narrative"));
    const validation = validateNarrativePayload(
      JSON.stringify({
        ...fallback,
        authoritative: true,
        state_patch: { control_score: 99 },
      }),
      "event_narrative"
    );

    expect(validation).toMatchObject({
      code: "authoritative_field_forbidden",
      ok: false,
    });
  });
});
