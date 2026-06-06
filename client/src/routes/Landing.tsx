import type { SetupParams } from './types';

interface LandingProps {
  onNavigate: (view: 'setup', params: SetupParams) => void;
}

export function Landing({ onNavigate }: LandingProps) {
  return (
    <div>
      <h1>Solar Dominion</h1>
      <p>Command your faction across the solar system.</p>
      <div>
        <button onClick={() => onNavigate('setup', { mode: 'create' })}>
          Create New Session
        </button>
        <button onClick={() => onNavigate('setup', { mode: 'resume' })}>
          Resume Session
        </button>
        <button onClick={() => onNavigate('setup', { mode: 'demo' })}>
          Start Local Demo
        </button>
      </div>
    </div>
  );
}
