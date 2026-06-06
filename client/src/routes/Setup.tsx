import { useState } from 'react';
import type { SessionMode, SetupState } from './types';

interface SetupProps {
  mode: SessionMode;
  onBack: () => void;
  onConfirm: (state: SetupState) => void;
}

const MODE_LABELS: Record<SessionMode, string> = {
  create: 'New Session',
  resume: 'Resume Session',
  demo: 'Local Demo',
};

export function Setup({ mode, onBack, onConfirm }: SetupProps) {
  const [playerName, setPlayerName] = useState('');

  return (
    <div>
      <h2>{MODE_LABELS[mode]}</h2>

      {mode === 'demo' && (
        <p>
          Two-browser local demo: open this app in two browser windows on the
          same machine. Each window plays one faction simultaneously.
        </p>
      )}

      <div>
        <label htmlFor="player-name">Player Name</label>
        <input
          id="player-name"
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
        />
      </div>

      <div>
        <button onClick={onBack}>Back</button>
        <button
          onClick={() => onConfirm({ playerName, mode })}
          disabled={playerName.trim() === ''}
        >
          {mode === 'resume' ? 'Continue' : 'Start'}
        </button>
      </div>
    </div>
  );
}
