import type {
  SessionStore,
  SubscriptionEvent,
  SubscriptionLoadStatus,
  SubscriptionSnapshot,
} from '../state/session-store';
import type { SpacetimeClient } from './client';

export const SESSION_SUBSCRIPTION_QUERIES = [
  'SELECT * FROM sessions',
  'SELECT * FROM player_slots',
  'SELECT * FROM public_game_state',
  'SELECT * FROM private_faction_state',
  'SELECT * FROM factions',
  'SELECT * FROM personnel',
  'SELECT * FROM intelligence_records',
  'SELECT * FROM events',
  'SELECT * FROM turn_summaries',
  'SELECT * FROM celestial_bodies',
  'SELECT * FROM public_factions',
  'SELECT * FROM public_cities',
  'SELECT * FROM public_fleets',
  'SELECT * FROM public_colony_ships',
  'SELECT * FROM public_events',
  'SELECT * FROM proposals',
] as const;

export interface SessionSubscriptionBridge {
  hydrate: (snapshot: SubscriptionSnapshot) => void;
  apply: (event: SubscriptionEvent) => void;
  setProposalsSubscription: (status: SubscriptionLoadStatus) => void;
}

export function wireSessionSubscriptions(
  store: SessionStore,
  client: SpacetimeClient,
  queries: readonly string[] = SESSION_SUBSCRIPTION_QUERIES,
): SessionSubscriptionBridge {
  client.subscribe([...queries]);
  store.getState().actions.setProposalsSubscription({ status: 'loading' });

  return {
    hydrate(snapshot) {
      store.getState().actions.hydrateSubscription(snapshot);
    },
    apply(event) {
      store.getState().actions.applySubscriptionEvent(event);
    },
    setProposalsSubscription(status) {
      store.getState().actions.setProposalsSubscription(status);
    },
  };
}
