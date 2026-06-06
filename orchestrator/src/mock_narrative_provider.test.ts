import { describe, expect, it } from "vitest";

import type { LlmModeRequest } from "./llm_mode_provider.js";
import { buildMockResponse } from "./mock_llm_provider.js";
import {
  NARRATIVE_REQUEST_TYPES,
  validateNarrativePayload,
} from "./narrative_contract.js";

const baseRequest = (
  requestType: (typeof NARRATIVE_REQUEST_TYPES)[number]
): LlmModeRequest => ({
  context: {
    faction_name: "Mars Compact",
    surface: "turn_resolution",
  },
  faction_id: 3,
  request_type: requestType,
  session_id: 9,
  turn: 5,
});

describe("mock narrative provider", () => {
  it("returns contract-valid deterministic narrative payloads when live generation is disabled", () => {
    for (const requestType of NARRATIVE_REQUEST_TYPES) {
      const first = buildMockResponse(baseRequest(requestType));
      const second = buildMockResponse(baseRequest(requestType));

      expect(second.response_json).toBe(first.response_json);

      const validation = validateNarrativePayload(
        first.response_json,
        requestType
      );
      expect(validation.ok).toBe(true);
      if (validation.ok) {
        expect(validation.payload.authoritative).toBe(false);
        expect(validation.payload.display_only).toBe(true);
        expect(validation.payload.metadata.faction_id).toBe(3);
      }
    }
  });
});
