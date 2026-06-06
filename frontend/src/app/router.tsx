import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import LandingPage from '../pages/LandingPage';
import SetupPage from '../pages/SetupPage';
import GamePage from '../pages/GamePage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'setup', element: <SetupPage /> },
      { path: 'game', element: <GamePage /> },
    ],
  },
]);
