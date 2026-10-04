import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './i18n/index.js';
import './index.css';
import { Layout } from './components/Layout.js';
import { LoginGate } from './components/LoginGate.js';
import { DashboardPage } from './pages/Dashboard.js';
import { DevicesPage } from './pages/Devices.js';
import { StorePage } from './pages/Store.js';
import { CalendarPage } from './pages/Calendar.js';
import { ForecastPage } from './pages/Forecast.js';
import { DevLogPage } from './pages/DevLog.js';
import { SafetyPage } from './pages/Safety.js';
import { SettingsPage } from './pages/Settings.js';
import { TutorialPage } from './pages/Tutorial.js';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 5000 } },
});

function App(): JSX.Element {
  return (
    <LoginGate>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="devices" element={<DevicesPage />} />
          <Route path="store" element={<StorePage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="forecast" element={<ForecastPage />} />
          <Route path="safety" element={<SafetyPage />} />
          <Route path="devlog" element={<DevLogPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="tutorial" element={<TutorialPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </LoginGate>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
