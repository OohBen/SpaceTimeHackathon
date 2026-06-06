import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import App from './App';
import LandingPage from '../pages/LandingPage';
import SetupPage from '../pages/SetupPage';
import GamePage from '../pages/GamePage';

export const appRouteChildren: RouteObject[] = [
  { index: true, element: <LandingPage /> },
  { path: 'setup', element: <SetupPage /> },
  { path: 'game', element: <GamePage /> },
  { path: 'game/:sessionId/:playerSlot', element: <GamePage /> },
];

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <App />,
      children: appRouteChildren,
    },
  ],
);
