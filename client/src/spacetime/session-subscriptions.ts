import type {
  SessionStore,
  SubscriptionEvent,
  SubscriptionSnapshot,
} from '../state/session-store';
import type { SpacetimeClient } from './client';

export const SESSION_SUBSCRIPTION_QUERIES = [
  'SELECT * FROM sessions',
  'SELECT * FROM player_slots',
  'SELECT * FROM public_game_state',
  'SELECT * FROM private_faction_state',
  'SELECT * FROM personnel',
  'SELECT * FROM intelligence_records',
] as const;

export interface SessionSubscriptionBridge {
  hydrate: (snapshot: SubscriptionSnapshot) => void;
  apply: (event: SubscriptionEvent) => void;
}

export function wireSessionSubscriptions(
  store: SessionStore,
  client: SpacetimeClient,
  queries: readonly string[] = SESSION_SUBSCRIPTION_QUERIES,
): SessionSubscriptionBridge {
  client.subscribe([...queries]);

  return {
    hydrate(snapshot) {
      store.getState().actions.hydrateSubscription(snapshot);
    },
    apply(event) {
      store.getState().actions.applySubscriptionEvent(event);
    },
  };
}
