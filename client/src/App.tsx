import { AppRouter } from './routes/AppRouter';
import type { SessionBackend } from './session/spacetime';

interface AppProps {
  backend?: SessionBackend;
}

export default function App({ backend }: AppProps) {
  return (
    <main>
      <AppRouter backend={backend} />
    </main>
  );
}
