import type { SessionStore } from '../state/session-store';
import type { ConnectionLifecycleEvent } from './client';

export function applyConnectionLifecycleEvent(
  store: SessionStore,
  event: ConnectionLifecycleEvent,
): void {
  store.getState().actions.setConnection({
    status: event.status,
    error: event.error,
    diagnostics: event.diagnostics,
  });
}
