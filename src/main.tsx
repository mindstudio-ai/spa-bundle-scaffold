import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as _App from './App.tsx';
import * as _OG from './OpenGraphCard.tsx';
import { default as AppPlaceholder } from './placeholders/App.tsx';
import { default as OGPlaceholder } from './placeholders/OpenGraphCard.tsx';
import GlobalStyle from './style/GlobalStyle.tsx';
import { StyleSheetManager } from 'styled-components';

const App = (_App as any).default || AppPlaceholder;
const hasCustomOG = !!((_OG as any).default);
const OpenGraphCard = hasCustomOG ? (_OG as any).default : OGPlaceholder;

const isScreenshot =
  new URLSearchParams(window.location.search).get('mode') === 'screenshot';

// In prod, if no custom OG card was provided, just render the main app for screenshots
const showOG = isScreenshot && (import.meta.env.DEV || hasCustomOG);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StyleSheetManager>
      <GlobalStyle />
      {showOG ? <OpenGraphCard /> : <App />}
    </StyleSheetManager>
  </StrictMode>,
);
