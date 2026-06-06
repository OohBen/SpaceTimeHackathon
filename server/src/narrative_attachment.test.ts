import { describe, expect, it } from 'vitest';

import {
  NARRATIVE_ATTACHMENT_SCHEMA_VERSION,
  attachNarrativeToCommanderInbox,
  attachNarrativeToEventPayload,
  attachNarrativeToTurnSummaryPayload,
  buildNarrativeAttachment,
} from './narrative_attachment.js';
import type {
  CommanderInboxRow,
  EventRow,
  TurnSummaryRow,
} from './turn1_seed.js';

const narrativePayload = {
  authoritative: false,
  display_only: true,
  headline: 'Resolution pulse',
  metadata: {
    faction_id: 2,
    privacy_scope: 'own_faction',
    session_id: 7,
    turn: 4,
  },
  prose: 'Command staff frames the turn as a logistics win, not a rules outcome.',
  request_type: 'event_narrative',
  schema_version: 1,
  source: 'fallback',
  surface: 'resolution',
} as const;

describe('narrative attachment flow', () => {
  it('stores generated inbox prose in a distinct display-only field', () => {
    const row: CommanderInboxRow = {
      id: 10,
      faction_id: 2,
      turn: 4,
      from_personnel_id: 1,
      subject: 'Turn 4 command brief',
      body: 'Authoritative order state stays here.',
      narrative_json: undefined,
      requires_decision: false,
      status: 'unread',
    };

    const attached = attachNarrativeToCommanderInbox(row, narrativePayload);
    const narrative = JSON.parse(attached.narrative_json!);

    expect(attached.body).toBe('Authoritative order state stays here.');
    expect(narrative).toMatchObject({
      authoritative: false,
      display_only: true,
      schema_version: NARRATIVE_ATTACHMENT_SCHEMA_VERSION,
      text: narrativePayload.prose,
    });
    expect(narrative).not.toHaveProperty('control_score');
  });

  it('embeds resolution narrative without changing authoritative summary data', () => {
    const summary: TurnSummaryRow = {
      id: 12,
      session_id: 7,
      faction_id: 2,
      turn: 4,
      summary_json: JSON.stringify({
        control_score: 42,
        event: 'turn_summary',
        simulation_outputs: { credit_income: { 2: 8 } },
      }),
      acknowledged: false,
      acknowledged_at: undefined,
      created_at: undefined as never,
      updated_at: undefined as never,
    };

    const attached = attachNarrativeToTurnSummaryPayload(summary, narrativePayload);
    const payload = JSON.parse(attached.summary_json);

    expect(payload.control_score).toBe(42);
    expect(payload.simulation_outputs).toEqual({ credit_income: { 2: 8 } });
    expect(payload.narrative).toMatchObject({
      authoritative: false,
      display_only: true,
      text: narrativePayload.prose,
    });
  });

  it('attaches event narrative under a namespaced display-only key', () => {
    const event: EventRow = {
      id: 20,
      session_id: 7,
      faction_id: 2,
      turn: 4,
      event_type: 'world_advanced',
      payload: JSON.stringify({ control_scores: { 2: { after: 42, before: 38, delta: 4 } } }),
      narrative_json: undefined,
    };

    const attached = attachNarrativeToEventPayload(event, narrativePayload);
    const payload = JSON.parse(attached.payload);

    expect(payload.control_scores).toEqual({ 2: { after: 42, before: 38, delta: 4 } });
    expect(payload.narrative).toMatchObject({
      authoritative: false,
      display_only: true,
      surface: 'resolution',
    });
    expect(attached.narrative_json).toBeDefined();
  });

  it('rejects attachment across faction privacy boundaries', () => {
    expect(() =>
      buildNarrativeAttachment({
        ...narrativePayload,
        metadata: {
          ...narrativePayload.metadata,
          faction_id: 3,
        },
      }, {
        faction_id: 2,
        session_id: 7,
        turn: 4,
      })
    ).toThrow(/faction mismatch/);
  });
});
