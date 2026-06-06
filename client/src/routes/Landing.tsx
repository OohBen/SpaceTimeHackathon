import type { SetupParams } from './types';

interface LandingProps {
  onNavigate: (view: 'setup', params: SetupParams) => void;
}

export function Landing({ onNavigate }: LandingProps) {
  return (
    <div className="landing">
      <div className="landing__card">
        <p className="landing__eyebrow">Strategy · Solar System</p>
        <h1 className="landing__title">Solar Dominion</h1>
        <p className="landing__intro">Command your faction across the solar system.</p>
        <div className="landing__actions">
          <button
            className="landing__action landing__action--primary"
            onClick={() => onNavigate('setup', { mode: 'create' })}
          >
            Create New Session
          </button>
          <button
            className="landing__action"
            onClick={() => onNavigate('setup', { mode: 'resume' })}
          >
            Resume Session
          </button>
          <button
            className="landing__action"
            onClick={() => onNavigate('setup', { mode: 'demo' })}
          >
            Start Local Demo
          </button>
        </div>
      </div>
    </div>
  );
}
