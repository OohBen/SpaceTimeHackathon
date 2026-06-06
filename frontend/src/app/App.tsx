import { Outlet, Link } from 'react-router-dom';

export default function App() {
  return (
    <div>
      <header>
        <h1>Command Center Bootstrap</h1>
        <p>Frontend shell for Solar Dominion.</p>
      </header>
      <nav aria-label="Primary">
        <Link to="/">Landing</Link>
        <Link to="/setup">Setup</Link>
        <Link to="/game/demo-session/p1">Game</Link>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
