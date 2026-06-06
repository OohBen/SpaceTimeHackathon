import type {
  LlmTextClient,
  LlmTextRequest,
  LlmTextResponse,
} from "./openrouter_client.js";

export const PROPOSAL_ADVISORY_SCHEMA_VERSION = 1;

export const PROPOSAL_ADVISORY_CONFIDENCE_VALUES = ["HIGH", "MEDIUM", "LOW"] as const;
export type ProposalAdvisoryConfidence =
  (typeof PROPOSAL_ADVISORY_CONFIDENCE_VALUES)[number];

export const PROPOSAL_ADVISORY_LIMITS = {
  maxBodyChars: 2_000,
  maxDepartmentChars: 64,
  maxProposals: 8,
  maxResourceCost: 1_000_000,
  maxTitleChars: 200,
  minProposals: 1,
  minResourceCost: 0,
} as const;

export type ProposalAdvisoryItem = {
  body: string;
  confidence: ProposalAdvisoryConfidence;
  department: string;
  resource_cost: number;
  title: string;
};

export type ProposalAdvisoryPayload = {
  proposals: ProposalAdvisoryItem[];
  schema_version: number;
};

export type ProposalAdvisoryFailureCategory =
  | "empty_input"
  | "empty_proposals"
  | "invalid_json"
  | "missing_field"
  | "schema_mismatch"
  | "too_many_proposals"
  | "type_mismatch"
  | "value_out_of_range";

export type ProposalAdvisoryRepairStep =
  | "noop"
  | "strip_code_fence"
  | "strip_leading_label"
  | "strip_trailing_garbage"
  | "extract_first_json_object";

export type ProposalAdvisorySuccess = {
  ok: true;
  payload: ProposalAdvisoryPayload;
  repairsApplied: ProposalAdvisoryRepairStep[];
  schemaVersion: number;
};

export type ProposalAdvisoryFailure = {
  category: ProposalAdvisoryFailureCategory;
  ok: false;
  raw: string;
  reason: string;
  repairsApplied: ProposalAdvisoryRepairStep[];
};

export type ProposalAdvisoryOutcome =
  | ProposalAdvisoryFailure
  | ProposalAdvisorySuccess;

export const PROPOSAL_ADVISORY_POLICY = {
  fallback_categories: [
    "empty_input",
    "empty_proposals",
    "invalid_json",
    "missing_field",
    "schema_mismatch",
    "too_many_proposals",
    "type_mismatch",
    "value_out_of_range",
  ] as const,
  max_repair_attempts: 1,
  reject_categories: [
    "empty_input",
    "empty_proposals",
    "invalid_json",
    "missing_field",
    "schema_mismatch",
    "too_many_proposals",
    "type_mismatch",
    "value_out_of_range",
  ] as const,
  repair_steps: [
    "strip_code_fence",
    "strip_leading_label",
    "strip_trailing_garbage",
    "extract_first_json_object",
  ] as const,
  schema_version: PROPOSAL_ADVISORY_SCHEMA_VERSION,
  source: "live_openrouter" as const,
} as const;

const CODE_FENCE_PATTERN = /^```(?:json|JSON)?\s*\n?([\s\S]*?)```\s*$/;
const LEADING_LABEL_PATTERN = /^[^\{]*?(?=\{)/;

export function validateProposalAdvisory(content: string): ProposalAdvisoryOutcome {
  const repairsApplied: ProposalAdvisoryRepairStep[] = [];
  const trimmed = content.trim();

  if (trimmed.length === 0) {
    return makeFailure("empty_input", "advisory content is empty", content, repairsApplied);
  }

  const parsed = parseWithRepair(trimmed, repairsApplied);
  if (!parsed.ok) {
    return makeFailure(parsed.category, parsed.reason, content, repairsApplied);
  }

  const value = parsed.value;
  if (!isRecord(value)) {
    return makeFailure(
      "schema_mismatch",
      "advisory payload must be a JSON object",
      content,
      repairsApplied
    );
  }

  if (!Array.isArray(value.proposals)) {
    return makeFailure(
      "missing_field",
      "advisory payload must contain a 'proposals' array",
      content,
      repairsApplied
    );
  }

  if (value.proposals.length < PROPOSAL_ADVISORY_LIMITS.minProposals) {
    return makeFailure(
      "empty_proposals",
      "advisory payload must contain at least one proposal",
      content,
      repairsApplied
    );
  }

  if (value.proposals.length > PROPOSAL_ADVISORY_LIMITS.maxProposals) {
    return makeFailure(
      "too_many_proposals",
      `advisory payload must contain at most ${PROPOSAL_ADVISORY_LIMITS.maxProposals} proposals`,
      content,
      repairsApplied
    );
  }

  const items: ProposalAdvisoryItem[] = [];
  for (let index = 0; index < value.proposals.length; index += 1) {
    const raw = value.proposals[index];
    const itemOutcome = validateProposalItem(raw, index);
    if (!itemOutcome.ok) {
      return makeFailure(
        itemOutcome.category,
        itemOutcome.reason,
        content,
        repairsApplied
      );
    }
    items.push(itemOutcome.item);
  }

  return {
    ok: true,
    payload: {
      proposals: items,
      schema_version: PROPOSAL_ADVISORY_SCHEMA_VERSION,
    },
    repairsApplied,
    schemaVersion: PROPOSAL_ADVISORY_SCHEMA_VERSION,
  };
}

export type ProposalAdvisoryFallback = (input: {
  reason: string;
  category: ProposalAdvisoryFailureCategory;
  request: LlmTextRequest;
}) => Promise<ProposalAdvisoryPayload> | ProposalAdvisoryPayload;

export type ProposalAdvisoryResult = {
  payload: ProposalAdvisoryPayload;
  raw: LlmTextResponse | null;
  source: "live" | "fallback";
  validation: ProposalAdvisoryOutcome;
};

export type ProposalAdvisoryClient = {
  completeProposalAdvisory(request: LlmTextRequest): Promise<ProposalAdvisoryResult>;
};

export function createProposalAdvisoryClient(
  text: LlmTextClient,
  options: { fallback: ProposalAdvisoryFallback }
): ProposalAdvisoryClient {
  return {
    async completeProposalAdvisory(request) {
      let raw: LlmTextResponse;
      try {
        raw = await text.completeText({
          ...request,
          responseFormat: "json_object",
        });
      } catch (cause) {
        const fallbackPayload = await options.fallback({
          category: "invalid_json",
          reason: cause instanceof Error ? cause.message : String(cause),
          request,
        });
        return {
          payload: fallbackPayload,
          raw: null,
          source: "fallback",
          validation: {
            category: "invalid_json",
            ok: false,
            raw: "",
            reason: cause instanceof Error ? cause.message : String(cause),
            repairsApplied: [],
          },
        };
      }

      const validation = validateProposalAdvisory(raw.content);
      if (validation.ok) {
        return {
          payload: validation.payload,
          raw,
          source: "live",
          validation,
        };
      }

      const fallbackPayload = await options.fallback({
        category: validation.category,
        reason: validation.reason,
        request,
      });
      return {
        payload: fallbackPayload,
        raw,
        source: "fallback",
        validation,
      };
    },
  };
}

type ParseSuccess = { ok: true; value: unknown };
type ParseFailure = {
  category: ProposalAdvisoryFailureCategory;
  ok: false;
  reason: string;
};

function parseWithRepair(
  initial: string,
  repairsApplied: ProposalAdvisoryRepairStep[]
): ParseFailure | ParseSuccess {
  const candidates = buildRepairCandidates(initial, repairsApplied);
  let lastError = "JSON.parse failed";
  for (const candidate of candidates) {
    try {
      return { ok: true, value: JSON.parse(candidate) };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  return {
    category: "invalid_json",
    ok: false,
    reason: lastError,
  };
}

function buildRepairCandidates(
  initial: string,
  repairsApplied: ProposalAdvisoryRepairStep[]
): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const add = (
    candidate: string,
    step: ProposalAdvisoryRepairStep | "initial"
  ): void => {
    if (!candidate || seen.has(candidate)) {
      return;
    }
    seen.add(candidate);
    candidates.push(candidate);
    if (step !== "initial") {
      repairsApplied.push(step);
    }
  };

  add(initial, "initial");

  const fenceMatch = initial.match(CODE_FENCE_PATTERN);
  if (fenceMatch) {
    add(fenceMatch[1].trim(), "strip_code_fence");
  }

  const baseForLabelStrip = candidates[candidates.length - 1];
  const labelStripped = baseForLabelStrip.replace(LEADING_LABEL_PATTERN, "");
  if (labelStripped !== baseForLabelStrip) {
    add(labelStripped.trim(), "strip_leading_label");
  }

  const baseForObject = candidates[candidates.length - 1];
  const extracted = extractFirstJsonObject(baseForObject);
  if (extracted && extracted !== baseForObject) {
    add(extracted, "extract_first_json_object");
  }

  const trailingStripped = stripTrailingGarbage(candidates[candidates.length - 1]);
  if (trailingStripped !== candidates[candidates.length - 1]) {
    add(trailingStripped, "strip_trailing_garbage");
  }

  return candidates;
}

function extractFirstJsonObject(input: string): string | null {
  const start = input.indexOf("{");
  if (start === -1) {
    return null;
  }
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < input.length; i += 1) {
    const ch = input[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return input.slice(start, i + 1);
      }
    }
  }
  return null;
}

function stripTrailingGarbage(input: string): string {
  const lastBrace = input.lastIndexOf("}");
  if (lastBrace === -1) {
    return input;
  }
  return input.slice(0, lastBrace + 1);
}

type ItemSuccess = { ok: true; item: ProposalAdvisoryItem };
type ItemFailure = {
  category: ProposalAdvisoryFailureCategory;
  ok: false;
  reason: string;
};

function validateProposalItem(raw: unknown, index: number): ItemFailure | ItemSuccess {
  if (!isRecord(raw)) {
    return failItem(
      "type_mismatch",
      `proposals[${index}] must be an object`
    );
  }

  const titleOutcome = readString(raw, "title", index, PROPOSAL_ADVISORY_LIMITS.maxTitleChars);
  if (!titleOutcome.ok) return titleOutcome;

  const bodyOutcome = readString(raw, "body", index, PROPOSAL_ADVISORY_LIMITS.maxBodyChars);
  if (!bodyOutcome.ok) return bodyOutcome;

  const departmentOutcome = readString(
    raw,
    "department",
    index,
    PROPOSAL_ADVISORY_LIMITS.maxDepartmentChars
  );
  if (!departmentOutcome.ok) return departmentOutcome;

  if (typeof raw.confidence !== "string") {
    return failItem(
      raw.confidence === undefined ? "missing_field" : "type_mismatch",
      `proposals[${index}].confidence must be a string`
    );
  }
  const confidenceUpper = raw.confidence.trim().toUpperCase();
  if (
    !PROPOSAL_ADVISORY_CONFIDENCE_VALUES.includes(
      confidenceUpper as ProposalAdvisoryConfidence
    )
  ) {
    return failItem(
      "value_out_of_range",
      `proposals[${index}].confidence must be one of HIGH, MEDIUM, LOW`
    );
  }

  if (typeof raw.resource_cost !== "number") {
    return failItem(
      raw.resource_cost === undefined ? "missing_field" : "type_mismatch",
      `proposals[${index}].resource_cost must be a number`
    );
  }
  if (!Number.isFinite(raw.resource_cost) || !Number.isInteger(raw.resource_cost)) {
    return failItem(
      "value_out_of_range",
      `proposals[${index}].resource_cost must be a finite integer`
    );
  }
  if (
    raw.resource_cost < PROPOSAL_ADVISORY_LIMITS.minResourceCost ||
    raw.resource_cost > PROPOSAL_ADVISORY_LIMITS.maxResourceCost
  ) {
    return failItem(
      "value_out_of_range",
      `proposals[${index}].resource_cost must be within [${PROPOSAL_ADVISORY_LIMITS.minResourceCost}, ${PROPOSAL_ADVISORY_LIMITS.maxResourceCost}]`
    );
  }

  return {
    ok: true,
    item: {
      body: bodyOutcome.value,
      confidence: confidenceUpper as ProposalAdvisoryConfidence,
      department: departmentOutcome.value,
      resource_cost: raw.resource_cost,
      title: titleOutcome.value,
    },
  };
}

type StringSuccess = { ok: true; value: string };
type StringFailure = ItemFailure;

function readString(
  record: Record<string, unknown>,
  field: string,
  index: number,
  maxLength: number
): StringFailure | StringSuccess {
  const value = record[field];
  if (value === undefined) {
    return failItem(
      "missing_field",
      `proposals[${index}].${field} is required`
    );
  }
  if (typeof value !== "string") {
    return failItem(
      "type_mismatch",
      `proposals[${index}].${field} must be a string`
    );
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return failItem(
      "value_out_of_range",
      `proposals[${index}].${field} must not be empty`
    );
  }
  if (trimmed.length > maxLength) {
    return failItem(
      "value_out_of_range",
      `proposals[${index}].${field} must be <= ${maxLength} characters`
    );
  }
  return { ok: true, value: trimmed };
}

function makeFailure(
  category: ProposalAdvisoryFailureCategory,
  reason: string,
  raw: string,
  repairsApplied: ProposalAdvisoryRepairStep[]
): ProposalAdvisoryFailure {
  return {
    category,
    ok: false,
    raw,
    reason,
    repairsApplied,
  };
}

function failItem(
  category: ProposalAdvisoryFailureCategory,
  reason: string
): ItemFailure {
  return { category, ok: false, reason };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
