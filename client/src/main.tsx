import React from 'react';
import ReactDOM from 'react-dom/client';
import { SpacetimeDBProvider } from 'spacetimedb/react';
import App from './App.tsx';
import { createConnectionBuilder } from './session/spacetime.ts';
import './index.css';

function Root() {
  const connectionBuilder = React.useMemo(() => createConnectionBuilder(), []);

  return (
    <SpacetimeDBProvider connectionBuilder={connectionBuilder}>
      <App />
    </SpacetimeDBProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
