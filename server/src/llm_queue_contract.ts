export const LLM_REQUEST_TYPE = {
  proposals: 'proposals',
  inbox: 'inbox',
  eventNarrative: 'event_narrative',
  resumeBriefing: 'resume_briefing',
} as const;

export const LLM_REQUEST_TYPES = [
  LLM_REQUEST_TYPE.proposals,
  LLM_REQUEST_TYPE.inbox,
  LLM_REQUEST_TYPE.eventNarrative,
  LLM_REQUEST_TYPE.resumeBriefing,
] as const;

export type LlmRequestType = typeof LLM_REQUEST_TYPES[number];

export const LLM_REQUEST_STATUS = {
  queued: 'queued',
  processing: 'processing',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'cancelled',
} as const;

export const LLM_REQUEST_STATUSES = [
  LLM_REQUEST_STATUS.queued,
  LLM_REQUEST_STATUS.processing,
  LLM_REQUEST_STATUS.completed,
  LLM_REQUEST_STATUS.failed,
  LLM_REQUEST_STATUS.cancelled,
] as const;

export type LlmRequestStatus = typeof LLM_REQUEST_STATUSES[number];

export const LLM_QUEUE_AUTHORITATIVE_CONTRACT = {
  live_model_required: false,
  authoritative_outcomes: [
    'game_sessions',
    'factions',
    'proposals',
    'turn_summaries',
  ],
  worker_output_role: 'advisory_text_only',
} as const;

export type LlmRequestRow = {
  id: number;
  session_id: number;
  faction_id: number;
  request_type: string;
  context_json: string;
  status: string;
  response_json: string | undefined;
  error: string | undefined;
  error_code: string | undefined;
  attempt_count: number;
  created_turn: number;
  updated_turn: number;
};

export type BuildQueuedLlmRequestInput = {
  session_id: number;
  faction_id: number;
  request_type: LlmRequestType;
  context: unknown;
  created_turn: number;
};

export function buildQueuedLlmRequest(input: BuildQueuedLlmRequestInput): LlmRequestRow {
  return {
    id: 0,
    session_id: input.session_id,
    faction_id: input.faction_id,
    request_type: input.request_type,
    context_json: stableJson(input.context),
    status: LLM_REQUEST_STATUS.queued,
    response_json: undefined,
    error: undefined,
    error_code: undefined,
    attempt_count: 0,
    created_turn: input.created_turn,
    updated_turn: input.created_turn,
  };
}

const stableJson = (value: unknown): string => JSON.stringify(stableValue(value));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)])
    );
  }
  return value;
}
