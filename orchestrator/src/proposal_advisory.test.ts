import { describe, expect, it } from "vitest";

import {
  PROPOSAL_ADVISORY_LIMITS,
  PROPOSAL_ADVISORY_POLICY,
  PROPOSAL_ADVISORY_SCHEMA_VERSION,
  createProposalAdvisoryClient,
  validateProposalAdvisory,
} from "./proposal_advisory.js";
import type {
  ProposalAdvisoryFailureCategory,
  ProposalAdvisoryOutcome,
  ProposalAdvisoryPayload,
} from "./proposal_advisory.js";
import type {
  LlmTextClient,
  LlmTextRequest,
  LlmTextResponse,
} from "./openrouter_client.js";

const validSingle = {
  proposals: [
    {
      body: "Increase fuel reserves in inner-belt depots to support rapid response.",
      confidence: "HIGH",
      department: "Logistics",
      resource_cost: 120,
      title: "Reinforce inner-belt logistics",
    },
  ],
};

const fallbackPayload: ProposalAdvisoryPayload = {
  proposals: [
    {
      body: "Deterministic fallback body",
      confidence: "MEDIUM",
      department: "Logistics",
      resource_cost: 0,
      title: "Deterministic fallback proposal",
    },
  ],
  schema_version: PROPOSAL_ADVISORY_SCHEMA_VERSION,
};

function expectFailure(
  outcome: ProposalAdvisoryOutcome
): outcome is { ok: false; category: ProposalAdvisoryFailureCategory; raw: string; reason: string; repairsApplied: never[] } {
  if (outcome.ok) {
    throw new Error("expected validation failure but got success");
  }
  return true;
}

function buildClient(responses: string[]): LlmTextClient {
  let index = 0;
  return {
    async completeText(request: LlmTextRequest): Promise<LlmTextResponse> {
      const content = responses[Math.min(index, responses.length - 1)];
      index += 1;
      return {
        content,
        model: "test-model",
        provider: "openrouter",
        raw: { content, request },
      };
    },
  };
}

describe("PROPOSAL_ADVISORY_POLICY", () => {
  it("documents the explicit schema version and repair allow-list", () => {
    expect(PROPOSAL_ADVISORY_POLICY.schema_version).toBe(
      PROPOSAL_ADVISORY_SCHEMA_VERSION
    );
    expect(PROPOSAL_ADVISORY_POLICY.repair_steps).toEqual([
      "strip_code_fence",
      "strip_leading_label",
      "strip_trailing_garbage",
      "extract_first_json_object",
    ]);
    expect(PROPOSAL_ADVISORY_POLICY.max_repair_attempts).toBe(1);
    expect(PROPOSAL_ADVISORY_POLICY.source).toBe("live_openrouter");
  });

  it("treats every failure category as both reject and fallback eligible", () => {
    expect([...PROPOSAL_ADVISORY_POLICY.reject_categories].sort()).toEqual(
      [...PROPOSAL_ADVISORY_POLICY.fallback_categories].sort()
    );
  });

  it("publishes bounded limits used by validation", () => {
    expect(PROPOSAL_ADVISORY_LIMITS.minProposals).toBe(1);
    expect(PROPOSAL_ADVISORY_LIMITS.maxProposals).toBe(8);
    expect(PROPOSAL_ADVISORY_LIMITS.maxTitleChars).toBeGreaterThan(0);
    expect(PROPOSAL_ADVISORY_LIMITS.maxBodyChars).toBeGreaterThan(0);
    expect(PROPOSAL_ADVISORY_LIMITS.maxResourceCost).toBeGreaterThan(
      PROPOSAL_ADVISORY_LIMITS.minResourceCost
    );
  });
});

describe("validateProposalAdvisory - accepts well-formed payloads", () => {
  it("returns parsed payload tagged with schema version when content is valid JSON", () => {
    const outcome = validateProposalAdvisory(JSON.stringify(validSingle));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.payload.schema_version).toBe(PROPOSAL_ADVISORY_SCHEMA_VERSION);
    expect(outcome.payload.proposals).toHaveLength(1);
    expect(outcome.repairsApplied).toEqual([]);
  });

  it("trims and normalises confidence enum casing", () => {
    const outcome = validateProposalAdvisory(
      JSON.stringify({
        proposals: [
          {
            ...validSingle.proposals[0],
            confidence: "  high  ",
          },
        ],
      })
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.payload.proposals[0].confidence).toBe("HIGH");
  });

  it("trims string fields without mutating originals", () => {
    const padded = JSON.stringify({
      proposals: [
        {
          body: "   padded body   ",
          confidence: "MEDIUM",
          department: "   Logistics   ",
          resource_cost: 10,
          title: "   padded title   ",
        },
      ],
    });
    const outcome = validateProposalAdvisory(padded);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const item = outcome.payload.proposals[0];
    expect(item.title).toBe("padded title");
    expect(item.body).toBe("padded body");
    expect(item.department).toBe("Logistics");
  });
});

describe("validateProposalAdvisory - repairs safe malformations", () => {
  it("strips markdown code fences before parsing", () => {
    const fenced = "```json\n" + JSON.stringify(validSingle) + "\n```";
    const outcome = validateProposalAdvisory(fenced);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.repairsApplied).toContain("strip_code_fence");
  });

  it("strips leading conversational label before JSON", () => {
    const noisy = "Sure, here are your proposals: " + JSON.stringify(validSingle);
    const outcome = validateProposalAdvisory(noisy);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.repairsApplied).toContain("strip_leading_label");
  });

  it("extracts the first complete JSON object when extra trailing text is appended", () => {
    const garbage =
      JSON.stringify(validSingle) +
      "\nNote: I hope this satisfies the schema constraints.";
    const outcome = validateProposalAdvisory(garbage);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const repairs = outcome.repairsApplied;
    expect(
      repairs.includes("extract_first_json_object") ||
        repairs.includes("strip_trailing_garbage")
    ).toBe(true);
  });
});

describe("validateProposalAdvisory - rejects malformed inputs", () => {
  it("rejects empty content", () => {
    const outcome = validateProposalAdvisory("   ");
    if (!expectFailure(outcome)) return;
    expect(outcome.category).toBe("empty_input");
  });

  it("rejects unparseable JSON even after repair attempts", () => {
    const outcome = validateProposalAdvisory("not actually JSON at all");
    if (!expectFailure(outcome)) return;
    expect(outcome.category).toBe("invalid_json");
  });

  it("rejects JSON that is not an object root", () => {
    const outcome = validateProposalAdvisory(JSON.stringify([1, 2, 3]));
    if (!expectFailure(outcome)) return;
    expect(["schema_mismatch", "missing_field"]).toContain(outcome.category);
  });

  it("rejects payloads missing the proposals array", () => {
    const outcome = validateProposalAdvisory(JSON.stringify({ items: [] }));
    if (!expectFailure(outcome)) return;
    expect(outcome.category).toBe("missing_field");
  });

  it("rejects payloads with an empty proposals array", () => {
    const outcome = validateProposalAdvisory(JSON.stringify({ proposals: [] }));
    if (!expectFailure(outcome)) return;
    expect(outcome.category).toBe("empty_proposals");
  });

  it("rejects payloads that exceed the proposal cap", () => {
    const items = Array.from(
      { length: PROPOSAL_ADVISORY_LIMITS.maxProposals + 1 },
      () => validSingle.proposals[0]
    );
    const outcome = validateProposalAdvisory(JSON.stringify({ proposals: items }));
    if (!expectFailure(outcome)) return;
    expect(outcome.category).toBe("too_many_proposals");
  });

  it("rejects proposals missing required fields", () => {
    const broken = {
      proposals: [
        {
          // title missing
          body: "Body",
          confidence: "HIGH",
          department: "Logistics",
          resource_cost: 10,
        },
      ],
    };
    const outcome = validateProposalAdvisory(JSON.stringify(broken));
    if (!expectFailure(outcome)) return;
    expect(outcome.category).toBe("missing_field");
  });

  it("rejects proposals with wrong type", () => {
    const broken = {
      proposals: [
        {
          body: "Body",
          confidence: "HIGH",
          department: "Logistics",
          resource_cost: "not-a-number",
          title: "Title",
        },
      ],
    };
    const outcome = validateProposalAdvisory(JSON.stringify(broken));
    if (!expectFailure(outcome)) return;
    expect(outcome.category).toBe("type_mismatch");
  });

  it("rejects unknown confidence enum values", () => {
    const broken = {
      proposals: [
        {
          body: "Body",
          confidence: "ENTHUSIASTIC",
          department: "Logistics",
          resource_cost: 10,
          title: "Title",
        },
      ],
    };
    const outcome = validateProposalAdvisory(JSON.stringify(broken));
    if (!expectFailure(outcome)) return;
    expect(outcome.category).toBe("value_out_of_range");
  });

  it("rejects partial JSON that cannot be safely repaired into an object", () => {
    const partial = '{"proposals":[{"title":"unterminated';
    const outcome = validateProposalAdvisory(partial);
    if (!expectFailure(outcome)) return;
    expect(["invalid_json", "missing_field", "schema_mismatch"]).toContain(
      outcome.category
    );
  });

  it("rejects resource_cost outside the documented range", () => {
    const broken = {
      proposals: [
        {
          body: "Body",
          confidence: "HIGH",
          department: "Logistics",
          resource_cost: -1,
          title: "Title",
        },
      ],
    };
    const outcome = validateProposalAdvisory(JSON.stringify(broken));
    if (!expectFailure(outcome)) return;
    expect(outcome.category).toBe("value_out_of_range");
  });
});

describe("validateProposalAdvisory - deterministic behavior", () => {
  it("returns byte-identical outcomes for identical inputs across calls", () => {
    const inputs = [
      JSON.stringify(validSingle),
      "```json\n" + JSON.stringify(validSingle) + "\n```",
      JSON.stringify({ proposals: [] }),
      "not json",
    ];
    for (const input of inputs) {
      const first = validateProposalAdvisory(input);
      const second = validateProposalAdvisory(input);
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    }
  });

  it("never mutates the input string", () => {
    const original = "```json\n" + JSON.stringify(validSingle) + "\n```";
    const snapshot = original;
    validateProposalAdvisory(original);
    expect(original).toBe(snapshot);
  });
});

describe("createProposalAdvisoryClient - gates live output", () => {
  it("returns live payload when validation passes", async () => {
    let fallbackCalls = 0;
    const client = createProposalAdvisoryClient(
      buildClient([JSON.stringify(validSingle)]),
      {
        fallback: () => {
          fallbackCalls += 1;
          return fallbackPayload;
        },
      }
    );
    const result = await client.completeProposalAdvisory({
      prompt: "p",
      system: "s",
    });
    expect(result.source).toBe("live");
    expect(result.payload.proposals).toHaveLength(1);
    expect(fallbackCalls).toBe(0);
  });

  it("routes to fallback when validation fails so schema-breaking output never reaches consumers", async () => {
    const fallbackCalls: Array<{ category: string; reason: string }> = [];
    const client = createProposalAdvisoryClient(buildClient(["not-json"]), {
      fallback: ({ category, reason }) => {
        fallbackCalls.push({ category, reason });
        return fallbackPayload;
      },
    });
    const result = await client.completeProposalAdvisory({
      prompt: "p",
      system: "s",
    });
    expect(result.source).toBe("fallback");
    expect(result.payload).toEqual(fallbackPayload);
    expect(fallbackCalls).toHaveLength(1);
    expect(fallbackCalls[0].category).toBe("invalid_json");
  });

  it("routes transport failure to fallback as invalid_json category", async () => {
    let fallbackCalls = 0;
    const client = createProposalAdvisoryClient(
      {
        async completeText(): Promise<LlmTextResponse> {
          throw new Error("transport failure");
        },
      },
      {
        fallback: () => {
          fallbackCalls += 1;
          return fallbackPayload;
        },
      }
    );
    const result = await client.completeProposalAdvisory({
      prompt: "p",
      system: "s",
    });
    expect(result.source).toBe("fallback");
    expect(fallbackCalls).toBe(1);
  });

  it("always forces json_object response format on the upstream request", async () => {
    const seen: LlmTextRequest[] = [];
    const upstream: LlmTextClient = {
      async completeText(request) {
        seen.push(request);
        return {
          content: JSON.stringify(validSingle),
          model: "test-model",
          provider: "openrouter",
          raw: {},
        };
      },
    };
    const client = createProposalAdvisoryClient(upstream, {
      fallback: () => fallbackPayload,
    });
    await client.completeProposalAdvisory({
      prompt: "p",
      system: "s",
    });
    expect(seen).toHaveLength(1);
    expect(seen[0].responseFormat).toBe("json_object");
  });
});
