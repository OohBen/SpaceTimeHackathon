import { useState } from 'react';
import type { SessionMode, SetupState } from './types';

interface SetupProps {
  mode: SessionMode;
  onBack: () => void;
  onSubmit: (state: SetupState) => Promise<void>;
}

const MODE_LABELS: Record<SessionMode, string> = {
  create: 'New Session',
  resume: 'Resume Session',
  demo: 'Local Demo',
};

export function Setup({ mode, onBack, onSubmit }: SetupProps) {
  const [playerName, setPlayerName] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [playerSlot, setPlayerSlot] = useState<'player_a' | 'player_b'>('player_a');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const state: SetupState = { playerName, mode };
      if (mode === 'resume') {
        state.sessionId = Number(sessionId);
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
    playerName.trim() !== '' &&
    (mode !== 'resume' || sessionId.trim() !== '');

  return (
    <div>
      <h2>{MODE_LABELS[mode]}</h2>

      {mode === 'demo' && (
        <p>
          Two-browser local demo: open this app in two browser windows on the
          same machine. Each window plays one faction simultaneously.
        </p>
      )}

      {loading && <p>Loading…</p>}
      {error && <p role="alert">{error}</p>}

      <div>
        <label htmlFor="player-name">Player Name</label>
        <input
          id="player-name"
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          disabled={loading}
        />
      </div>

      {mode === 'resume' && (
        <>
          <div>
            <label htmlFor="session-id">Session ID</label>
            <input
              id="session-id"
              type="number"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="player-slot">Player Slot</label>
            <select
              id="player-slot"
              value={playerSlot}
              onChange={(e) => setPlayerSlot(e.target.value as 'player_a' | 'player_b')}
              disabled={loading}
            >
              <option value="player_a">Player A</option>
              <option value="player_b">Player B</option>
            </select>
          </div>
        </>
      )}

      <div>
        <button onClick={onBack} disabled={loading}>Back</button>
        <button onClick={handleConfirm} disabled={!canConfirm}>
          {mode === 'resume' ? 'Continue' : 'Start'}
        </button>
      </div>
    </div>
  );
}
