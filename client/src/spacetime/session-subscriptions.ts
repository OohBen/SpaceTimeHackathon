import type {
  SessionStore,
  SubscriptionEvent,
  SubscriptionLoadStatus,
  SubscriptionSnapshot,
} from '../state/session-store';
import type { SpacetimeClient } from './client';

// Subscription queries target the real server tables and views exposed by
// `server/src/index.ts` (see `docs/P4E1-integration-contracts-audit.md`).
// Each query corresponds to a logical surface the playable path consumes:
//   - game_sessions / factions: session lifecycle, faction state, slot binding
//   - public_factions / public_cities / public_fleets / public_colony_ships /
//     public_events: redacted projections used by opposing-player views
//   - celestial_bodies / personnel / intelligence_records: world + roster surface
//   - proposals / commander_inbox: deliberation + decision UI
//   - turn_summaries / events: resolution + summary UI
//   - llm_requests / module_settings: orchestrator boundary visibility
export const SESSION_SUBSCRIPTION_QUERIES = [
  'SELECT * FROM game_sessions',
  'SELECT * FROM factions',
  'SELECT * FROM celestial_bodies',
  'SELECT * FROM personnel',
  'SELECT * FROM intelligence_records',
  'SELECT * FROM public_factions',
  'SELECT * FROM public_cities',
  'SELECT * FROM public_fleets',
  'SELECT * FROM public_colony_ships',
  'SELECT * FROM public_events',
  'SELECT * FROM proposals',
  'SELECT * FROM commander_inbox',
  'SELECT * FROM turn_summaries',
  'SELECT * FROM events',
  'SELECT * FROM llm_requests',
  'SELECT * FROM module_settings',
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
