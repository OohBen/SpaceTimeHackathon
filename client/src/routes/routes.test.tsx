import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Landing } from './Landing';
import { Setup } from './Setup';
import { AppRouter } from './AppRouter';
import type { SessionBackend } from '../session/spacetime';

function backend(): SessionBackend {
  return {
    isConnected: true,
    identity: null,
    sessions: [],
    factions: [],
    getSessionChoices: () => [],
    getSlotChoices: () => [],
    joinOrResume: vi.fn(),
    createAndJoin: vi.fn(),
  };
}

describe('Landing', () => {
  it('renders all three entry choices', () => {
    render(<Landing onNavigate={() => {}} />);
    expect(screen.getByRole('button', { name: /create/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /resume/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /local demo/i })).toBeDefined();
  });

  it('calls onNavigate with setup when Create is clicked', () => {
    const onNavigate = vi.fn();
    render(<Landing onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    expect(onNavigate).toHaveBeenCalledWith('setup', { mode: 'create' });
  });

  it('calls onNavigate with setup when Resume is clicked', () => {
    const onNavigate = vi.fn();
    render(<Landing onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: /resume/i }));
    expect(onNavigate).toHaveBeenCalledWith('setup', { mode: 'resume' });
  });

  it('calls onNavigate with setup when Local Demo is clicked', () => {
    const onNavigate = vi.fn();
    render(<Landing onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: /local demo/i }));
    expect(onNavigate).toHaveBeenCalledWith('setup', { mode: 'demo' });
  });
});

describe('Setup', () => {
  it('renders the two-browser demo path explanation', () => {
    render(<Setup mode="demo" onBack={() => {}} onSubmit={() => Promise.resolve()} />);
    expect(screen.getByText(/two.browser/i)).toBeDefined();
  });

  it('preserves player name state', () => {
    render(<Setup mode="create" onBack={() => {}} onSubmit={() => Promise.resolve()} />);
    const input = screen.getByRole('textbox', { name: /player name/i });
    fireEvent.change(input, { target: { value: 'Commander Atlas' } });
    expect((input as HTMLInputElement).value).toBe('Commander Atlas');
  });

  it('calls onBack when back is clicked', () => {
    const onBack = vi.fn();
    render(<Setup mode="create" onBack={onBack} onSubmit={() => Promise.resolve()} />);
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('calls onSubmit with state when confirmed', async () => {
    const onSubmit = vi.fn(() => Promise.resolve());
    render(<Setup mode="create" onBack={() => {}} onSubmit={onSubmit} />);
    const input = screen.getByRole('textbox', { name: /player name/i });
    fireEvent.change(input, { target: { value: 'Admiral Rex' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm|start|continue/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      playerName: 'Admiral Rex',
      mode: 'create',
      opponentName: '',
      playerSlot: 'player_a',
    });
  });

  it('shows loading state while mutation is pending', async () => {
    let resolve!: () => void;
    const pending = new Promise<void>((r) => { resolve = r; });
    render(<Setup mode="create" onBack={() => {}} onSubmit={() => pending} />);
    fireEvent.change(screen.getByRole('textbox', { name: /player name/i }), { target: { value: 'Atlas' } });
    fireEvent.click(screen.getByRole('button', { name: /start/i }));
    expect(screen.getByText(/loading/i)).toBeDefined();
    resolve();
  });

  it('shows error message when mutation rejects', async () => {
    const onSubmit = vi.fn(() => Promise.reject(new Error('duplicate session')));
    render(<Setup mode="create" onBack={() => {}} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole('textbox', { name: /player name/i }), { target: { value: 'Atlas' } });
    fireEvent.click(screen.getByRole('button', { name: /start/i }));
    await screen.findByText(/duplicate session/i);
  });

  it('shows session ID input in resume mode', () => {
    render(<Setup mode="resume" onBack={() => {}} onSubmit={() => Promise.resolve()} />);
    expect(screen.getByRole('spinbutton', { name: /session id/i })).toBeDefined();
  });
});

describe('AppRouter', () => {
  it('renders Landing by default', () => {
    render(<AppRouter backend={backend()} />);
    expect(screen.getByRole('button', { name: /create/i })).toBeDefined();
  });

  it('navigates to Setup when Create is clicked', () => {
    render(<AppRouter backend={backend()} />);
    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    expect(screen.getByRole('textbox', { name: /player name/i })).toBeDefined();
  });

  it('navigates back to Landing from Setup', () => {
    render(<AppRouter backend={backend()} />);
    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByRole('button', { name: /create/i })).toBeDefined();
  });
});
