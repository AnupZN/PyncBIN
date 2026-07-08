import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Prevent benign ResizeObserver loop errors from bubbling up and interrupting the app
if (typeof window !== 'undefined') {
  const resizeObserverError = /ResizeObserver loop/;
  
  const originalError = window.console.error;
  window.console.error = (...args) => {
    if (args[0] && typeof args[0] === 'string' && resizeObserverError.test(args[0])) {
      return;
    }
    originalError.apply(window.console, args);
  };

  window.addEventListener('error', (e) => {
    if (e.message && resizeObserverError.test(e.message)) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register Service Worker for PWA Offline Caching
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('Pyncbin PWA Service Worker registered:', reg.scope);
      })
      .catch((err) => {
        console.warn('PWA Service Worker registration failed:', err);
      });
  });
}
