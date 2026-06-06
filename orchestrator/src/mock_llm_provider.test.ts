import { describe, expect, it } from "vitest";

import { LLM_REQUEST_TYPES, LlmModeRequest } from "./llm_mode_provider.js";
import {
  buildMockResponse,
  createMockLlmModeProvider,
} from "./mock_llm_provider.js";
import { validateProposalAdvisory } from "./proposal_advisory.js";

const baseRequest = (
  overrides: Partial<LlmModeRequest> = {}
): LlmModeRequest => ({
  context: { officers: ["alice", "bob"], pressure: 0.4 },
  faction_id: 1,
  request_type: "proposals",
  session_id: 1,
  turn: 3,
  ...overrides,
});

describe("mock provider", () => {
  it("returns the same response for identical input", () => {
    const left = buildMockResponse(baseRequest());
    const right = buildMockResponse(baseRequest());
    expect(left).toEqual(right);
    expect(left.response_json).toBe(right.response_json);
  });

  it("ignores key ordering in context when computing the response", () => {
    const left = buildMockResponse(
      baseRequest({ context: { officers: ["alice", "bob"], pressure: 0.4 } })
    );
    const right = buildMockResponse(
      baseRequest({ context: { pressure: 0.4, officers: ["alice", "bob"] } })
    );
    expect(left.response_json).toBe(right.response_json);
  });

  it("produces different response_json for different turns", () => {
    const earlier = buildMockResponse(baseRequest({ turn: 1 }));
    const later = buildMockResponse(baseRequest({ turn: 9 }));
    expect(earlier.response_json).not.toBe(later.response_json);
  });

  it("covers every supported request type with parseable JSON", () => {
    for (const requestType of LLM_REQUEST_TYPES) {
      const response = buildMockResponse(baseRequest({ request_type: requestType }));
      expect(response.source).toBe("mock");
      expect(response.request_type).toBe(requestType);
      const parsed = JSON.parse(response.response_json) as Record<string, unknown>;
      expect(parsed.schema_version).toBe(1);
    }
  });

  it("emits proposal payloads in the live advisory shape", () => {
    const response = buildMockResponse(baseRequest({ request_type: "proposals" }));
    const parsed = JSON.parse(response.response_json) as {
      proposals: Array<{
        body: string;
        confidence: string;
        department: string;
        resource_cost: number;
        title: string;
      }>;
    };
    expect(parsed.proposals.length).toBeGreaterThan(0);
    for (const proposal of parsed.proposals) {
      expect(typeof proposal.title).toBe("string");
      expect(typeof proposal.body).toBe("string");
      expect(typeof proposal.department).toBe("string");
      expect(["HIGH", "MEDIUM", "LOW"]).toContain(proposal.confidence);
      expect(proposal.resource_cost).toBeGreaterThanOrEqual(0);
    }
  });

  it("round-trips proposal payloads through the live advisory validator", () => {
    for (const turn of [1, 3, 8, 12]) {
      const response = buildMockResponse(
        baseRequest({ request_type: "proposals", turn })
      );
      const outcome = validateProposalAdvisory(response.response_json);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.payload.schema_version).toBe(1);
      }
    }
  });

  it("distinguishes sparse contexts so undefined keys do not collide", () => {
    const sparse = buildMockResponse(
      baseRequest({ context: { officers: ["a"], pressure: undefined } })
    );
    const dense = buildMockResponse(
      baseRequest({ context: { officers: ["a"] } })
    );
    expect(sparse.response_json).not.toBe(dense.response_json);
  });

  it("never touches process.env or fetch", async () => {
    const provider = createMockLlmModeProvider();
    const envProxy = new Proxy(
      { _untouched: true },
      {
        get: () => {
          throw new Error("mock provider must not read process.env");
        },
      }
    ) as unknown as NodeJS.ProcessEnv;
    const originalEnv = process.env;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error("mock provider must not invoke fetch");
    }) as typeof fetch;
    Object.defineProperty(process, "env", { configurable: true, value: envProxy });
    try {
      const result = await provider.completeRequest(baseRequest());
      expect(result.source).toBe("mock");
    } finally {
      Object.defineProperty(process, "env", { configurable: true, value: originalEnv });
      globalThis.fetch = originalFetch;
    }
  });
});
