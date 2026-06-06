import { useState } from 'react';
import type { SessionBackend } from '../session/spacetime';
import type { PlayerSlot, SessionMode, SetupState, SlotChoice } from './types';

interface SetupProps {
  mode: SessionMode;
  backend?: SessionBackend;
  onBack: () => void;
  onSubmit: (state: SetupState) => Promise<void>;
}

const MODE_LABELS: Record<SessionMode, string> = {
  create: 'New Session',
  resume: 'Resume Session',
  demo: 'Local Demo',
};

const DEMO_SLOT_CHOICES: SlotChoice[] = [
  {
    key: 'player_a',
    label: 'P1',
    factionName: 'Solar Republic',
    status: 'available',
    recovery: 'Browser A enters as the Solar Republic commander.',
  },
  {
    key: 'player_b',
    label: 'P2',
    factionName: 'Martian League',
    status: 'available',
    recovery: 'Browser B enters as the Martian League commander.',
  },
];

export function Setup({ mode, backend, onBack, onSubmit }: SetupProps) {
  const firstSessionId = backend?.getSessionChoices()[0]?.id.toString() ?? '';
  const [playerName, setPlayerName] = useState('');
  const [opponentName, setOpponentName] = useState('');
  const [sessionId, setSessionId] = useState(firstSessionId);
  const [playerSlot, setPlayerSlot] = useState<PlayerSlot>('player_a');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedSessionId = sessionId.trim() === '' ? undefined : Number(sessionId);
  const slotChoices =
    mode === 'resume'
      ? backend?.getSlotChoices(selectedSessionId) ?? []
      : mode === 'demo'
        ? DEMO_SLOT_CHOICES
        : [];
  const selectedSlot = slotChoices.find(slot => slot.key === playerSlot);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const state: SetupState = { playerName, mode };
      if (mode === 'create') {
        state.opponentName = opponentName;
        state.playerSlot = playerSlot;
      }
      if (mode === 'resume') {
        state.sessionId = Number(sessionId);
        state.playerSlot = playerSlot;
      }
      if (mode === 'demo') {
        state.playerSlot = playerSlot;
      }
      await onSubmit(state);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const canConfirm =
    !loading &&
    (backend?.isConnected ?? true) &&
    playerName.trim() !== '' &&
    (mode !== 'resume' ||
      (sessionId.trim() !== '' && selectedSlot?.status !== 'occupied')) &&
    (mode !== 'demo' || selectedSlot?.status !== 'occupied');

  return (
    <div>
      <h2>{MODE_LABELS[mode]}</h2>

      {mode === 'demo' && (
        <p>
          Two-browser local demo: open this app in two browser windows on the
          same machine. Each window plays one faction simultaneously.
        </p>
      )}

      {loading && <p>Loading...</p>}
      {error && <p role="alert">{error}</p>}

      <div>
        <label htmlFor="player-name">Player Name</label>
        <input
          id="player-name"
          type="text"
          value={playerName}
          onChange={e => setPlayerName(e.target.value)}
          disabled={loading}
        />
      </div>

      {mode === 'create' && (
        <div>
          <label htmlFor="opponent-name">Opponent Name</label>
          <input
            id="opponent-name"
            type="text"
            value={opponentName}
            onChange={e => setOpponentName(e.target.value)}
            disabled={loading}
          />
        </div>
      )}

      {(mode === 'resume' || mode === 'demo') && (
        <>
          {mode === 'resume' && (
            <div>
              <label htmlFor="session-id">Session ID</label>
              <input
                id="session-id"
                type="number"
                value={sessionId}
                onChange={e => setSessionId(e.target.value)}
                disabled={loading}
              />
            </div>
          )}
          <div>
            <p id="slot-picker-label">Player Slot</p>
            <div aria-labelledby="slot-picker-label">
              {slotChoices.map(slot => {
                const demoBrowser = slot.key === 'player_a' ? 'Browser A' : 'Browser B';
                const prefix = mode === 'demo' ? `${demoBrowser} ` : '';

                return (
                  <div key={slot.key}>
                    <button
                      type="button"
                      aria-pressed={playerSlot === slot.key}
                      disabled={loading || slot.status === 'occupied'}
                      onClick={() => setPlayerSlot(slot.key)}
                    >
                      {prefix}{slot.label} {slot.factionName} {slot.status}
                    </button>
                    <p>{slot.recovery}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <div>
        <button onClick={onBack} disabled={loading}>Back</button>
        <button onClick={handleConfirm} disabled={!canConfirm}>
          {mode === 'resume' ? 'Join Slot' : 'Start'}
        </button>
      </div>
    </div>
  );
}
