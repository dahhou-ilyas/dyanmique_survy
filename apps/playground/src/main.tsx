import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './app.css';

// Les thèmes du package : `builder.css` inclut déjà `default.css`.
import '@dahhouilyas/survey/themes/builder.css';

const container = document.getElementById('root');
if (!container) throw new Error('Élément #root introuvable.');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
