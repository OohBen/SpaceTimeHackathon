import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import {
  LLM_QUEUE_AUTHORITATIVE_CONTRACT,
  LLM_REQUEST_STATUSES,
  LLM_REQUEST_TYPES,
  buildQueuedLlmRequest,
} from './llm_queue_contract.js';

const schemaSrc = () =>
  readFileSync(resolve(import.meta.dirname, 'schema.ts'), 'utf8');

describe('llm queue contract', () => {
  it('supports all reducer-facing request types', () => {
    expect(LLM_REQUEST_TYPES).toEqual([
      'proposals',
      'inbox',
      'event_narrative',
      'resume_briefing',
    ]);
  });

  it('documents worker lifecycle states and terminal failures', () => {
    expect(LLM_REQUEST_STATUSES).toEqual([
      'queued',
      'processing',
      'completed',
      'failed',
      'cancelled',
    ]);
  });

  it('builds queued rows without making live-model output authoritative', () => {
    const request = buildQueuedLlmRequest({
      session_id: 7,
      faction_id: 2,
      request_type: 'event_narrative',
      context: { turn: 4, event_id: 99 },
      created_turn: 4,
    });

    expect(request).toEqual({
      id: 0,
      session_id: 7,
      faction_id: 2,
      request_type: 'event_narrative',
      context_json: '{"event_id":99,"turn":4}',
      status: 'queued',
      response_json: undefined,
      error: undefined,
      error_code: undefined,
      attempt_count: 0,
      created_turn: 4,
      updated_turn: 4,
    });
    expect(LLM_QUEUE_AUTHORITATIVE_CONTRACT.live_model_required).toBe(false);
    expect(LLM_QUEUE_AUTHORITATIVE_CONTRACT.authoritative_outcomes).toEqual([
      'game_sessions',
      'factions',
      'proposals',
      'turn_summaries',
    ]);
  });

  it('keeps failure and polling fields in the authoritative schema', () => {
    const src = schemaSrc();

    expect(src).toContain('error_code: t.option(t.string())');
    expect(src).toContain('attempt_count: t.u32()');
    expect(src).toContain('updated_turn: t.u32()');
    expect(src).toContain('llm_status_idx');
    expect(src).toContain('llm_session_turn_idx');
  });
});
