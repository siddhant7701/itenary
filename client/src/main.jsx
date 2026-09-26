import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/bricolage-grotesque';
import './styles.css';
import App from './App';
import { API_ORIGIN } from './lib/api';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // Tell the service worker where the API lives so trips stay readable offline when it's on another domain.
  const sw = '/sw.js' + (API_ORIGIN ? `?api=${encodeURIComponent(API_ORIGIN)}` : '');
  window.addEventListener('load', () => navigator.serviceWorker.register(sw).catch(() => {}));
}
