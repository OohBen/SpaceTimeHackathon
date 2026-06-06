import type {
  CommanderInboxRow,
  EventRow,
  TurnSummaryRow,
} from './turn1_seed.js';

export const NARRATIVE_ATTACHMENT_SCHEMA_VERSION = 1;

export type NarrativeAttachmentPayload = {
  authoritative: false;
  display_only: true;
  headline?: string;
  metadata: {
    faction_id: number;
    privacy_scope: 'own_faction';
    session_id: number;
    turn: number;
  };
  prose: string;
  request_type: string;
  schema_version: number;
  source: string;
  surface: string;
};

export type NarrativeAttachmentTarget = {
  faction_id?: number;
  session_id?: number;
  turn?: number;
};

export function buildNarrativeAttachment(
  payload: NarrativeAttachmentPayload,
  target: NarrativeAttachmentTarget
): string {
  assertDisplayOnlyPayload(payload);
  assertTargetMatch(payload, target);

  return stableJson({
    authoritative: false,
    display_only: true,
    headline: sanitize(payload.headline ?? ''),
    metadata: {
      faction_id: payload.metadata.faction_id,
      privacy_scope: 'own_faction',
      session_id: payload.metadata.session_id,
      turn: payload.metadata.turn,
    },
    request_type: payload.request_type,
    schema_version: NARRATIVE_ATTACHMENT_SCHEMA_VERSION,
    source: payload.source,
    surface: payload.surface,
    text: sanitize(payload.prose),
  });
}

export function attachNarrativeToCommanderInbox(
  row: CommanderInboxRow,
  payload: NarrativeAttachmentPayload
): CommanderInboxRow {
  return {
    ...row,
    narrative_json: buildNarrativeAttachment(payload, {
      faction_id: row.faction_id,
      turn: row.turn,
    }),
  };
}

export function attachNarrativeToEventPayload(
  row: EventRow,
  payload: NarrativeAttachmentPayload
): EventRow {
  const narrativeJson = buildNarrativeAttachment(payload, {
    faction_id: row.faction_id ?? undefined,
    session_id: row.session_id,
    turn: row.turn,
  });
  const body = parseJsonObject(row.payload);

  return {
    ...row,
    narrative_json: narrativeJson,
    payload: stableJson({
      ...body,
      narrative: JSON.parse(narrativeJson),
    }),
  };
}

export function attachNarrativeToTurnSummaryPayload(
  row: TurnSummaryRow,
  payload: NarrativeAttachmentPayload
): TurnSummaryRow {
  const narrativeJson = buildNarrativeAttachment(payload, {
    faction_id: row.faction_id,
    session_id: row.session_id,
    turn: row.turn,
  });
  const body = parseJsonObject(row.summary_json);

  return {
    ...row,
    narrative_json: narrativeJson,
    summary_json: stableJson({
      ...body,
      narrative: JSON.parse(narrativeJson),
    }),
  };
}

function assertDisplayOnlyPayload(payload: NarrativeAttachmentPayload): void {
  if (payload.authoritative !== false || payload.display_only !== true) {
    throw new Error('narrative payload must be display-only and non-authoritative');
  }
  if (payload.metadata.privacy_scope !== 'own_faction') {
    throw new Error('narrative payload must use own_faction privacy');
  }
}

function assertTargetMatch(
  payload: NarrativeAttachmentPayload,
  target: NarrativeAttachmentTarget
): void {
  if (
    target.faction_id !== undefined &&
    payload.metadata.faction_id !== target.faction_id
  ) {
    throw new Error(
      `narrative faction mismatch: ${payload.metadata.faction_id} != ${target.faction_id}`
    );
  }
  if (
    target.session_id !== undefined &&
    payload.metadata.session_id !== target.session_id
  ) {
    throw new Error(
      `narrative session mismatch: ${payload.metadata.session_id} != ${target.session_id}`
    );
  }
  if (target.turn !== undefined && payload.metadata.turn !== target.turn) {
    throw new Error(`narrative turn mismatch: ${payload.metadata.turn} != ${target.turn}`);
  }
}

function sanitize(value: string): string {
  return value.replace(/[<>]/g, '').slice(0, 640);
}

function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    if (isRecord(parsed)) {
      return parsed;
    }
  } catch {
    return {};
  }
  return {};
}

const stableJson = (value: unknown): string => JSON.stringify(stableValue(value));

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])])
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
