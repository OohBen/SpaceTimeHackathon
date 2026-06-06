import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

describe('App routes', () => {
  it('renders landing content by default', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /command center bootstrap/i })).toBeInTheDocument();
    expect(screen.getByText(/landing surface/i)).toBeInTheDocument();
  });

  it('renders setup and game route placeholders', () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/setup']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText(/setup surface/i)).toBeInTheDocument();

    rerender(
      <MemoryRouter initialEntries={['/game']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText(/game surface/i)).toBeInTheDocument();
  });
});
