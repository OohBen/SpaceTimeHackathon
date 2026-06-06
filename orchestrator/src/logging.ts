// Secret-safe telemetry surface for the OpenRouter client + reliability wrapper.
// All operator-facing log fields MUST go through the redaction helpers below so
// API keys and prompt content never leak into stdout, structured logs, or test
// fixtures. Callers may bring their own sink; the default is a no-op so the
// orchestrator stays silent unless explicitly wired up.

export type TelemetryLevel = "debug" | "info" | "warn" | "error";

export type TelemetryFields = Record<string, unknown>;

export type TelemetryEvent = {
  event: string;
  fields: TelemetryFields;
  level: TelemetryLevel;
};

export type TelemetryLogger = {
  log(event: TelemetryEvent): void;
};

export const noopTelemetryLogger: TelemetryLogger = {
  log: () => undefined,
};

const REDACTION_TAIL_KEEP = 2;
const REDACTION_HEAD_KEEP = 3;
const REDACTION_MIN_LEN = 8;
const REDACTION_PLACEHOLDER = "***";
const MISSING_PLACEHOLDER = "<missing>";

export function redactSecret(value: string | undefined | null): string {
  if (value === undefined || value === null) {
    return MISSING_PLACEHOLDER;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return MISSING_PLACEHOLDER;
  }
  if (trimmed.length < REDACTION_MIN_LEN) {
    return REDACTION_PLACEHOLDER;
  }
  return `${trimmed.slice(0, REDACTION_HEAD_KEEP)}${REDACTION_PLACEHOLDER}${trimmed.slice(
    -REDACTION_TAIL_KEEP
  )}`;
}

export function redactPayloadShape(value: unknown): unknown {
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return `<string:${value.length}>`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return typeof value;
  }
  if (Array.isArray(value)) {
    return `<array:${value.length}>`;
  }
  if (typeof value === "object") {
    return `<object:${Object.keys(value as Record<string, unknown>).length}>`;
  }
  return typeof value;
}

export function summarizeRequest(input: {
  maxTokens?: number;
  prompt?: string;
  responseFormat?: string;
  system?: string;
  temperature?: number;
}): TelemetryFields {
  return {
    max_tokens: input.maxTokens,
    prompt: redactPayloadShape(input.prompt),
    response_format: input.responseFormat,
    system: redactPayloadShape(input.system),
    temperature: input.temperature,
  };
}

export function summarizeErrorCause(cause: unknown): TelemetryFields {
  if (cause instanceof Error) {
    return { name: cause.name || "Error" };
  }
  if (cause === null) {
    return { type: "null" };
  }
  return { type: typeof cause };
}
