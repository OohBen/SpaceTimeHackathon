import type { SetupParams } from './types';

interface LandingProps {
  onNavigate: (view: 'setup', params: SetupParams) => void;
}

export function Landing({ onNavigate }: LandingProps) {
  return (
    <div className="landing fl-stage">
      <div className="landing__orbital" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="landing__card glass">
        <div className="landing__crests" aria-hidden="true">
          <span>A</span>
          <i>VS</i>
          <span className="landing__crest--warm">B</span>
        </div>
        <h1 className="landing__title">Solar <span>Dominion</span></h1>
        <p className="landing__intro">Two commanders. One solar theater. Simultaneous turns.</p>
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
        </div>
        <p className="landing__status">Maincloud link active · live LLM proposals queued by worker</p>
      </div>
    </div>
  );
}
