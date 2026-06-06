import { useMemo, useState, useSyncExternalStore } from 'react';
import {
  sessionStore,
  selectCurrentPlayerSlot,
  selectProposalsSubscriptionStatus,
  type PlayerSlotRow,
  type ProposalRow,
  type SessionState,
  type SessionStore,
  type SubscriptionLoadStatus,
} from '../../state/session-store';

export interface InboxProps {
  store?: SessionStore;
  selectedProposalId?: string | null;
  onSelectProposal?: (proposalId: string | null) => void;
}

interface InboxView {
  proposals: ProposalRow[];
  subscription: SubscriptionLoadStatus;
  selected: ProposalRow | null;
}

export function Inbox({
  store = sessionStore,
  selectedProposalId,
  onSelectProposal,
}: InboxProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const controlled = selectedProposalId !== undefined;
  const activeSelectedId = controlled ? selectedProposalId ?? null : internalSelectedId;

  const proposalsById = useStoreSlice(store, (state) => state.proposalsById);
  const subscription = useStoreSlice(store, selectProposalsSubscriptionStatus);
  const activeSessionId = useStoreSlice(store, (state) => state.activeSessionId);
  const currentSlot = useStoreSlice(store, selectCurrentPlayerSlot);

  const view = useMemo<InboxView>(() => {
    const proposals = computeInboxProposals(proposalsById, activeSessionId, currentSlot);
    const selected = activeSelectedId ? proposalsById[activeSelectedId] ?? null : null;
    return { proposals, subscription, selected };
  }, [proposalsById, subscription, activeSessionId, currentSlot, activeSelectedId]);

  const handleSelect = (id: string | null) => {
    if (!controlled) setInternalSelectedId(id);
    onSelectProposal?.(id);
  };

  return (
    <section
      aria-label="Commander inbox"
      data-testid="commander-inbox"
      style={{
        border: '1px solid #d5d7dc',
        borderRadius: 8,
        display: 'grid',
        gridTemplateColumns: 'minmax(260px, 1fr) minmax(0, 2fr)',
        gap: 16,
        padding: 16,
      }}
    >
      <ProposalList
        view={view}
        selectedId={activeSelectedId}
        onSelect={handleSelect}
      />
      <ProposalReader view={view} />
    </section>
  );
}

interface ProposalListProps {
  view: InboxView;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

function ProposalList({ view, selectedId, onSelect }: ProposalListProps) {
  if (view.subscription.status === 'loading' || view.subscription.status === 'idle') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Inbox loading"
        data-testid="inbox-loading"
      >
        Loading proposals…
      </div>
    );
  }

  if (view.subscription.status === 'error') {
    return (
      <div role="alert" data-testid="inbox-error">
        <p style={{ margin: 0 }}>Unable to load proposals.</p>
        <p style={{ margin: '4px 0 0', color: '#a00' }}>{view.subscription.error}</p>
      </div>
    );
  }

  if (view.proposals.length === 0) {
    return (
      <div role="status" data-testid="inbox-empty">
        <p style={{ margin: 0, fontWeight: 600 }}>No proposals waiting.</p>
        <p style={{ margin: '4px 0 0' }}>
          New officer proposals will appear here when your council submits them.
        </p>
      </div>
    );
  }

  return (
    <ul
      role="list"
      data-testid="inbox-list"
      style={{ listStyle: 'none', margin: 0, padding: 0 }}
    >
      {view.proposals.map((proposal) => {
        const selected = proposal.id === selectedId;
        return (
          <li key={proposal.id} style={{ marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => onSelect(proposal.id)}
              aria-pressed={selected}
              data-testid={`inbox-item-${proposal.id}`}
              style={{
                background: selected ? '#eef3ff' : 'transparent',
                border: selected ? '1px solid #4a6cff' : '1px solid #e2e4ea',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'block',
                padding: 12,
                textAlign: 'left',
                width: '100%',
              }}
            >
              <strong style={{ display: 'block' }}>{proposal.title}</strong>
              <span style={{ color: '#555', fontSize: 13 }}>
                {proposal.department} · Turn {proposal.turn} · {proposal.status}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ProposalReader({ view }: { view: InboxView }) {
  if (view.subscription.status === 'error' || view.subscription.status === 'loading') {
    return (
      <article
        aria-label="Proposal detail"
        data-testid="proposal-reader-idle"
        style={{ color: '#666' }}
      >
        Select a proposal once they have loaded.
      </article>
    );
  }

  const proposal = view.selected;
  if (!proposal) {
    return (
      <article
        aria-label="Proposal detail"
        data-testid="proposal-reader-empty"
        style={{ color: '#666' }}
      >
        Select a proposal to read full details.
      </article>
    );
  }

  return (
    <article
      aria-label={`Proposal detail: ${proposal.title}`}
      data-testid={`proposal-reader-${proposal.id}`}
    >
      <header style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>{proposal.title}</h3>
        <p style={{ margin: '4px 0 0', color: '#555' }}>
          {proposal.department} · Turn {proposal.turn}
        </p>
      </header>
      <dl
        data-testid="proposal-reader-meta"
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          rowGap: 4,
          columnGap: 12,
          margin: '8px 0',
        }}
      >
        <dt>Department</dt>
        <dd>{proposal.department}</dd>
        <dt>Proposing officer</dt>
        <dd>#{proposal.proposingPersonnelId}</dd>
        <dt>Resource cost</dt>
        <dd>{proposal.resourceCost}</dd>
        <dt>Confidence</dt>
        <dd>{proposal.confidence}</dd>
        <dt>Status</dt>
        <dd>{proposal.status}</dd>
        <dt>Decision</dt>
        <dd>{proposal.decision ?? 'pending'}</dd>
      </dl>
      <p style={{ whiteSpace: 'pre-wrap' }}>{proposal.body}</p>
    </article>
  );
}

function useStoreSlice<T>(store: SessionStore, selector: (state: SessionState) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}

function computeInboxProposals(
  proposalsById: Record<string, ProposalRow>,
  activeSessionId: string | null,
  slot: PlayerSlotRow | null,
): ProposalRow[] {
  if (!activeSessionId || !slot) return [];
  return Object.values(proposalsById)
    .filter(
      (proposal) =>
        proposal.sessionId === activeSessionId && proposal.factionId === slot.factionId,
    )
    .sort((a, b) => {
      if (a.turn !== b.turn) return b.turn - a.turn;
      return a.id.localeCompare(b.id);
    });
}

export const __internal = { computeInboxProposals };
