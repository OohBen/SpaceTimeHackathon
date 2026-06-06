import React from 'react';
import ReactDOM from 'react-dom/client';
import { SpacetimeDBProvider } from 'spacetimedb/react';
import App from './App.tsx';
import { createConnectionBuilder } from './session/spacetime.ts';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SpacetimeDBProvider connectionBuilder={createConnectionBuilder()}>
      <App />
    </SpacetimeDBProvider>
  </React.StrictMode>
);
