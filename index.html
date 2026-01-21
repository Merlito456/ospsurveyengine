
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

// Prevention: Disable standard browser refresh keyboard shortcuts
window.addEventListener('keydown', (e) => {
  // Block F5
  if (e.key === 'F5') {
    e.preventDefault();
    console.warn('Navigation blocked: Refreshing is disabled to protect active survey data.');
  }
  // Block Ctrl+R or Cmd+R
  if ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R')) {
    e.preventDefault();
    console.warn('Navigation blocked: Refreshing is disabled to protect active survey data.');
  }
}, { capture: true });

// Prevention: Warn user before leaving or reloading via standard UI
window.addEventListener('beforeunload', (e) => {
  // Standard way to trigger a "Confirm Reload" dialog in browsers
  e.preventDefault();
  e.returnValue = ''; 
});

// Register Service Worker with WebView-specific update logic
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const protocol = window.location.protocol;
    if (protocol !== 'http:' && protocol !== 'https:') return;

    const href = window.location.href;
    const swUrl = href.substring(0, href.lastIndexOf('/') + 1) + 'sw.js';
    
    navigator.serviceWorker.register(swUrl)
      .then(registration => {
        console.log('Offline Protection Active');
        
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Background sync: The new version is ready for the next cold start
              }
            });
          }
        });
      })
      .catch(err => {
        const isSandbox = window.location.hostname.includes('usercontent.goog') || 
                          window.location.hostname.includes('ai.studio');
        if (!isSandbox) console.error('Offline Sync Failed:', err);
      });
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element");

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
