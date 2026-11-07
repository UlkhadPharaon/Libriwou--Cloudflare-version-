import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n';
// @ts-ignore
import { registerSW } from 'virtual:pwa-register';
import { initAnalytics } from './services/analytics';

const updateSW = registerSW({
  onNeedRefresh() {},
  onOfflineReady() {},
})

// Phase 5.2 — analytics is a no-op until VITE_POSTHOG_KEY is configured and the user
// has granted consent, so a missing key can never break the app.
initAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
