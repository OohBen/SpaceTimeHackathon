import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import App from './App';
import { appRouteChildren } from './router';

function renderRoute(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <App />,
        children: appRouteChildren,
      },
    ],
    { initialEntries: [path] },
  );

  return render(<RouterProvider router={router} />);
}

describe('App routes', () => {
  it('renders landing content by default', () => {
    renderRoute('/');

    expect(screen.getByRole('heading', { name: /command center bootstrap/i })).toBeInTheDocument();
    expect(screen.getByText(/landing surface/i)).toBeInTheDocument();
  });

  it('renders setup and game route placeholders', () => {
    const setupRoute = renderRoute('/setup');

    expect(screen.getByText(/setup surface/i)).toBeInTheDocument();

    setupRoute.unmount();
    renderRoute('/game/demo-session/p1');

    expect(screen.getByText(/game surface/i)).toBeInTheDocument();
  });

  it('keeps a bootstrap game fallback route', () => {
    renderRoute('/game');

    expect(screen.getByText(/game surface/i)).toBeInTheDocument();
  });
});
