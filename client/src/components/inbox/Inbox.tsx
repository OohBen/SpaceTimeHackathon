import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { SpacetimeClient } from '../../spacetime/client';
import {
  commanderDecisionAction,
  commanderDecisionKey,
  expireTurnAction,
  expireTurnKey,
  submitTurnAction,
  submitTurnKey,
} from '../../spacetime/session-actions';
import type { CommanderDecision, CommanderDecisionArgs } from '../../spacetime/reducers';
import {
  sessionStore,
  selectActiveSession,
  selectCurrentPlayerSlot,
  selectPrivateFactionState,
  selectReducerCall,
  selectProposalsSubscriptionStatus,
  type PlayerSlotRow,
  type PrivateFactionStateRow,
  type PublicFactionRow,
  type ProposalRow,
  type ReducerCallState,
  type SessionRow,
  type SessionState,
  type SessionStore,
  type SubscriptionLoadStatus,
} from '../../state/session-store';

export interface InboxProps {
  store?: SessionStore;
  client?: SpacetimeClient;
  selectedProposalId?: string | null;
  onSelectProposal?: (proposalId: string | null) => void;
}

interface InboxView {
  proposals: ProposalRow[];
  subscription: SubscriptionLoadStatus;
  selected: ProposalRow | null;
  activeSession: SessionRow | null;
  currentSlot: PlayerSlotRow | null;
  factionState: PrivateFactionStateRow | null;
  publicFactions: PublicFactionRow[];
  decisionCall: ReducerCallState | null;
  submitTurnCall: ReducerCallState | null;
  expireTurnCall: ReducerCallState | null;
}

export function Inbox({
  store = sessionStore,
  client,
  selectedProposalId,
  onSelectProposal,
}: InboxProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const controlled = selectedProposalId !== undefined;
  const activeSelectedId = controlled ? selectedProposalId ?? null : internalSelectedId;

  const proposalsById = useStoreSlice(store, (state) => state.proposalsById);
  const subscription = useStoreSlice(store, selectProposalsSubscriptionStatus);
  const activeSessionId = useStoreSlice(store, (state) => state.activeSessionId);
  const activeSession = useStoreSlice(store, selectActiveSession);
  const currentSlot = useStoreSlice(store, selectCurrentPlayerSlot);
  const publicFactionsByKey = useStoreSlice(store, (state) => state.publicFactionsByKey);
  const publicFactions = useMemo(() => {
    if (!activeSessionId) return [];
    return Object.values(publicFactionsByKey)
      .filter((faction) => faction.sessionId === activeSessionId)
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [activeSessionId, publicFactionsByKey]);
  const factionState = useStoreSlice(store, (state) =>
    currentSlot ? selectPrivateFactionState(state, currentSlot.factionId) : null,
  );
  const decisionCall = useStoreSlice(store, (state) =>
    activeSelectedId ? selectReducerCall(state, commanderDecisionKey(activeSelectedId)) : null,
  );
  const submitTurnCall = useStoreSlice(store, (state) =>
    currentSlot ? selectReducerCall(state, submitTurnKey(currentSlot.factionId)) : null,
  );
  const expireTurnCall = useStoreSlice(store, (state) =>
    activeSessionId ? selectReducerCall(state, expireTurnKey(activeSessionId)) : null,
  );

  const view = useMemo<InboxView>(() => {
    const proposals = computeInboxProposals(proposalsById, activeSessionId, currentSlot);
    const selected = activeSelectedId ? proposalsById[activeSelectedId] ?? null : null;
    return {
      proposals,
      subscription,
      selected,
      activeSession,
      currentSlot,
      factionState,
      publicFactions,
      decisionCall,
      submitTurnCall,
      expireTurnCall,
    };
  }, [
    proposalsById,
    subscription,
    activeSessionId,
    activeSession,
    currentSlot,
    activeSelectedId,
    factionState,
    publicFactions,
    decisionCall,
    submitTurnCall,
    expireTurnCall,
  ]);

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
      <TurnWorkflowPanel view={view} store={store} client={client} />
      <ProposalList
        view={view}
        selectedId={activeSelectedId}
        onSelect={handleSelect}
      />
      <ProposalReader view={view} store={store} client={client} />
    </section>
  );
}

interface TurnWorkflowPanelProps {
  view: InboxView;
  store: SessionStore;
  client?: SpacetimeClient;
}

function TurnWorkflowPanel({ view, store, client }: TurnWorkflowPanelProps) {
  if (!view.activeSession || !view.currentSlot) return null;

  const activeSession = view.activeSession;
  const currentSlot = view.currentSlot;
  const sessionId = toNonNegativeInteger(activeSession.id);
  const factionId = toNonNegativeInteger(currentSlot.factionId);
  const currentTurn = activeSession.currentTurn;
  const pendingDecisions = view.proposals.filter(
    (proposal) => proposal.turn === currentTurn && isOpenForDecision(proposal),
  );
  const ownFaction =
    view.publicFactions.find((faction) => faction.id === currentSlot.factionId) ?? null;
  const opponentFactions = view.publicFactions.filter(
    (faction) => faction.id !== currentSlot.factionId,
  );
  const opponentReady =
    opponentFactions.length === 0
      ? 'unknown'
      : opponentFactions.every((faction) => faction.readyForTurn)
        ? 'ready'
        : 'not ready';
  const ownReady = ownFaction?.readyForTurn ?? false;
  const inDecisionPhase = activeSession.phase === 'decision';
  const submitLoading = view.submitTurnCall?.status === 'loading';
  const timeoutLoading = view.expireTurnCall?.status === 'loading';
  const readyToSubmit =
    pendingDecisions.length === 0 &&
    inDecisionPhase &&
    Boolean(client) &&
    factionId !== null &&
    !ownReady &&
    !submitLoading;
  const canProcessTimeout =
    inDecisionPhase && Boolean(client) && sessionId !== null && !timeoutLoading;

  const handleSubmitTurn = () => {
    if (!client || factionId === null || !readyToSubmit) return;
    submitTurnAction(store, client, { factionId });
  };

  const handleProcessTimeout = () => {
    if (!client || sessionId === null || !canProcessTimeout) return;
    expireTurnAction(store, client, { sessionId });
  };

  return (
    <section
      aria-label="Turn submission"
      style={{
        borderBottom: '1px solid #e2e4ea',
        display: 'grid',
        gap: 10,
        gridColumn: '1 / -1',
        paddingBottom: 14,
      }}
    >
      <div
        data-testid="turn-readiness"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}
      >
        <strong>Turn {view.activeSession?.currentTurn ?? '-'}</strong>
        <span>You: {ownReady ? 'ready' : 'not ready'}</span>
        <span>Opponent: {opponentReady}</span>
      </div>

      <p data-testid="turn-submit-readiness" style={{ margin: 0 }}>
        {pendingDecisions.length === 0
          ? 'Ready to submit: all required decisions recorded.'
          : `Not ready: ${pendingDecisions.length} decision${
              pendingDecisions.length === 1 ? '' : 's'
            } pending.`}
      </p>

      <TurnSubmitStatus
        clientReady={Boolean(client)}
        factionIdReady={factionId !== null}
        inDecisionPhase={inDecisionPhase}
        ownReady={ownReady}
        call={view.submitTurnCall}
      />

      <TurnTimeoutStatus call={view.expireTurnCall} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" disabled={!readyToSubmit} onClick={handleSubmitTurn}>
          Submit turn
        </button>
        <button type="button" disabled={!canProcessTimeout} onClick={handleProcessTimeout}>
          Process timeout
        </button>
      </div>
    </section>
  );
}

function TurnSubmitStatus({
  clientReady,
  factionIdReady,
  inDecisionPhase,
  ownReady,
  call,
}: {
  clientReady: boolean;
  factionIdReady: boolean;
  inDecisionPhase: boolean;
  ownReady: boolean;
  call: ReducerCallState | null;
}) {
  if (call?.status === 'loading') {
    return (
      <p data-testid="turn-submit-status" role="status" style={{ margin: 0 }}>
        Submitting turn...
      </p>
    );
  }
  if (call?.status === 'success' || ownReady) {
    return (
      <p data-testid="turn-submit-status" role="status" style={{ margin: 0 }}>
        Turn submitted. Waiting for opponent.
      </p>
    );
  }
  if (call?.status === 'error') {
    return (
      <p data-testid="turn-submit-status" role="alert" style={{ color: '#a00', margin: 0 }}>
        Backend rejected turn submit: {call.error}
      </p>
    );
  }
  if (!inDecisionPhase) {
    return (
      <p data-testid="turn-submit-status" style={{ margin: 0 }}>
        Submit available during decision phase.
      </p>
    );
  }
  if (!factionIdReady) {
    return (
      <p data-testid="turn-submit-status" role="alert" style={{ color: '#a00', margin: 0 }}>
        Live numeric faction ID required before turn submit.
      </p>
    );
  }
  if (!clientReady) {
    return (
      <p data-testid="turn-submit-status" style={{ margin: 0 }}>
        Backend connection unavailable.
      </p>
    );
  }
  return null;
}

function TurnTimeoutStatus({ call }: { call: ReducerCallState | null }) {
  if (call?.status === 'loading') {
    return (
      <p data-testid="turn-timeout-status" role="status" style={{ margin: 0 }}>
        Processing timeout...
      </p>
    );
  }
  if (call?.status === 'success') {
    return (
      <p data-testid="turn-timeout-status" role="status" style={{ margin: 0 }}>
        Timeout processed; unresolved proposals auto-deferred.
      </p>
    );
  }
  if (call?.status === 'error') {
    return (
      <p data-testid="turn-timeout-status" role="alert" style={{ color: '#a00', margin: 0 }}>
        Backend rejected timeout: {call.error}
      </p>
    );
  }
  return null;
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

function ProposalReader({
  view,
  store,
  client,
}: {
  view: InboxView;
  store: SessionStore;
  client?: SpacetimeClient;
}) {
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
      {isAutoDeferredByTimeout(proposal) ? (
        <p role="status" style={{ margin: '8px 0', color: '#7a4b00' }}>
          Auto-deferred by timeout.
        </p>
      ) : null}
      <p style={{ whiteSpace: 'pre-wrap' }}>{proposal.body}</p>
      <ProposalDecisionControls
        proposal={proposal}
        currentSlot={view.currentSlot}
        factionState={view.factionState}
        decisionCall={view.decisionCall}
        store={store}
        client={client}
      />
    </article>
  );
}

interface ProposalDecisionControlsProps {
  proposal: ProposalRow;
  currentSlot: PlayerSlotRow | null;
  factionState: PrivateFactionStateRow | null;
  decisionCall: ReducerCallState | null;
  store: SessionStore;
  client?: SpacetimeClient;
}

function ProposalDecisionControls({
  proposal,
  currentSlot,
  factionState,
  decisionCall,
  store,
  client,
}: ProposalDecisionControlsProps) {
  const [allocationInput, setAllocationInput] = useState(() => String(proposal.resourceCost));
  const resources = factionState?.resources ?? {};
  const creditBalance = resources.credits;
  const availableCredits =
    typeof creditBalance === 'number' && Number.isFinite(creditBalance) ? creditBalance : 0;
  const resourceEntries = Object.entries(resources).sort(([a], [b]) => a.localeCompare(b));
  const reducerIds = toReducerIds(proposal, currentSlot);
  const allocation = parseAllocation(allocationInput);
  const allocationValidation = validateApprovalAllocation(
    allocation,
    proposal.resourceCost,
    availableCredits,
  );
  const terminal = hasTerminalDecision(proposal);
  const openForDecision = isOpenForDecision(proposal);
  const loading = decisionCall?.status === 'loading';
  const canSubmitBase = Boolean(client && reducerIds && openForDecision && !terminal && !loading);
  const disableApprove = !canSubmitBase || allocationValidation !== null;
  const disableNonSpendDecision = !canSubmitBase;
  const inputId = `proposal-${proposal.id}-allocation`;

  useEffect(() => {
    setAllocationInput(String(proposal.resourceCost));
  }, [proposal.id, proposal.resourceCost]);

  const submitDecision = (decision: CommanderDecision) => {
    if (!client || !reducerIds || !openForDecision || terminal || loading) return;
    if (decision === 'approved' && (allocation === null || allocationValidation)) return;

    commanderDecisionAction(store, client, {
      ...reducerIds,
      decision,
      allocation: decision === 'approved' ? allocation ?? 0 : 0,
    });
  };

  return (
    <section
      aria-label="Proposal decision controls"
      style={{
        borderTop: '1px solid #e2e4ea',
        display: 'grid',
        gap: 12,
        marginTop: 16,
        paddingTop: 16,
      }}
    >
      <div data-testid="available-resources">
        <p style={{ fontWeight: 600, margin: 0 }}>Available credits: {availableCredits}</p>
        {resourceEntries.length > 0 ? (
          <ul
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              listStyle: 'none',
              margin: '8px 0 0',
              padding: 0,
            }}
          >
            {resourceEntries.map(([name, value]) => (
              <li
                key={name}
                style={{
                  border: '1px solid #e2e4ea',
                  borderRadius: 6,
                  padding: '4px 8px',
                }}
              >
                {name}: {value}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: '#666', margin: '4px 0 0' }}>No resource data available.</p>
        )}
      </div>

      <label htmlFor={inputId} style={{ display: 'grid', gap: 4, maxWidth: 220 }}>
        Credits allocation
        <input
          id={inputId}
          type="number"
          min={0}
          max={availableCredits}
          step={1}
          value={allocationInput}
          disabled={loading || terminal}
          aria-invalid={allocationValidation ? true : undefined}
          aria-describedby={allocationValidation ? `${inputId}-validation` : undefined}
          onChange={(event) => setAllocationInput(event.currentTarget.value)}
        />
      </label>

      {allocationValidation ? (
        <p
          id={`${inputId}-validation`}
          role="alert"
          style={{ color: '#a00', margin: 0 }}
        >
          {allocationValidation}
        </p>
      ) : null}

      <DecisionStatus
        clientReady={Boolean(client)}
        idsReady={Boolean(reducerIds)}
        openForDecision={openForDecision}
        terminal={terminal}
        decisionCall={decisionCall}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          type="button"
          disabled={disableApprove}
          onClick={() => submitDecision('approved')}
        >
          Approve
        </button>
        <button
          type="button"
          disabled={disableNonSpendDecision}
          onClick={() => submitDecision('rejected')}
        >
          Reject
        </button>
        <button
          type="button"
          disabled={disableNonSpendDecision}
          onClick={() => submitDecision('deferred')}
        >
          Defer
        </button>
      </div>
    </section>
  );
}

function DecisionStatus({
  clientReady,
  idsReady,
  openForDecision,
  terminal,
  decisionCall,
}: {
  clientReady: boolean;
  idsReady: boolean;
  openForDecision: boolean;
  terminal: boolean;
  decisionCall: ReducerCallState | null;
}) {
  if (decisionCall?.status === 'loading') {
    return <p role="status" style={{ margin: 0 }}>Submitting decision...</p>;
  }
  if (decisionCall?.status === 'success') {
    return <p role="status" style={{ margin: 0 }}>Decision submitted.</p>;
  }
  if (decisionCall?.status === 'error') {
    return (
      <p role="alert" style={{ color: '#a00', margin: 0 }}>
        Backend rejected decision: {decisionCall.error}
      </p>
    );
  }
  if (terminal) {
    return <p role="status" style={{ margin: 0 }}>Decision already recorded.</p>;
  }
  if (!openForDecision) {
    return <p role="status" style={{ margin: 0 }}>Proposal is not open for decision.</p>;
  }
  if (!idsReady) {
    return (
      <p role="alert" style={{ color: '#a00', margin: 0 }}>
        Live numeric proposal and faction IDs are required before decisions can be submitted.
      </p>
    );
  }
  if (!clientReady) {
    return <p role="status" style={{ margin: 0 }}>Backend connection unavailable.</p>;
  }
  return null;
}

function useStoreSlice<T>(store: SessionStore, selector: (state: SessionState) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}

const openProposalStatuses = new Set(['pending', 'unread', 'read']);
const terminalProposalStatuses = new Set(['approved', 'rejected', 'deferred', 'auto_deferred']);

function isOpenForDecision(proposal: ProposalRow): boolean {
  return proposal.decision === null && openProposalStatuses.has(proposal.status);
}

function hasTerminalDecision(proposal: ProposalRow): boolean {
  return proposal.decision !== null || terminalProposalStatuses.has(proposal.status);
}

function isAutoDeferredByTimeout(proposal: ProposalRow): boolean {
  if (proposal.status !== 'auto_deferred') return false;
  if (!proposal.decision) return true;

  try {
    const decision = JSON.parse(proposal.decision) as { reason?: unknown };
    return decision.reason === 'timeout';
  } catch {
    return true;
  }
}

function parseAllocation(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const allocation = Number(value);
  return Number.isSafeInteger(allocation) ? allocation : null;
}

function validateApprovalAllocation(
  allocation: number | null,
  resourceCost: number,
  availableCredits: number,
): string | null {
  if (allocation === null) return 'Enter a whole number of credits.';
  if (allocation < resourceCost) return `Approve requires at least ${resourceCost} credits.`;
  if (allocation > availableCredits) return `Only ${availableCredits} credits available.`;
  return null;
}

function toReducerIds(
  proposal: ProposalRow,
  currentSlot: PlayerSlotRow | null,
): Pick<CommanderDecisionArgs, 'factionId' | 'proposalId'> | null {
  const factionId = currentSlot ? toNonNegativeInteger(currentSlot.factionId) : null;
  const proposalId = toNonNegativeInteger(proposal.id);
  if (factionId === null || proposalId === null) return null;
  return { factionId, proposalId };
}

function toNonNegativeInteger(value: string | number): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) return null;
  return parsed;
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
