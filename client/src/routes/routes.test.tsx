import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Landing } from './Landing';
import { Setup } from './Setup';
import { AppRouter } from './AppRouter';

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
    render(<Setup mode="demo" onBack={() => {}} onConfirm={() => {}} />);
    expect(screen.getByText(/two.browser/i)).toBeDefined();
  });

  it('preserves player name state', () => {
    render(<Setup mode="create" onBack={() => {}} onConfirm={() => {}} />);
    const input = screen.getByRole('textbox', { name: /player name/i });
    fireEvent.change(input, { target: { value: 'Commander Atlas' } });
    expect((input as HTMLInputElement).value).toBe('Commander Atlas');
  });

  it('calls onBack when back is clicked', () => {
    const onBack = vi.fn();
    render(<Setup mode="create" onBack={onBack} onConfirm={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('calls onConfirm with state when confirmed', () => {
    const onConfirm = vi.fn();
    render(<Setup mode="create" onBack={() => {}} onConfirm={onConfirm} />);
    const input = screen.getByRole('textbox', { name: /player name/i });
    fireEvent.change(input, { target: { value: 'Admiral Rex' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm|start|continue/i }));
    expect(onConfirm).toHaveBeenCalledWith({ playerName: 'Admiral Rex', mode: 'create' });
  });
});

describe('AppRouter', () => {
  it('renders Landing by default', () => {
    render(<AppRouter />);
    expect(screen.getByRole('button', { name: /create/i })).toBeDefined();
  });

  it('navigates to Setup when Create is clicked', () => {
    render(<AppRouter />);
    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    expect(screen.getByRole('textbox', { name: /player name/i })).toBeDefined();
  });

  it('navigates back to Landing from Setup', () => {
    render(<AppRouter />);
    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByRole('button', { name: /create/i })).toBeDefined();
  });
});
