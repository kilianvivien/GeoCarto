import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { App } from '@/app/App';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { isTauri } from '@/app/platform';
import { registerServiceWorker } from '@/app/registerServiceWorker';
import '@/index.css';

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    {/* Web-only: the Tauri shell has no Vercel deployment to report to. */}
    {!isTauri() && <Analytics />}
  </StrictMode>,
);
