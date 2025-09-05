import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import GlobalStyle from './style/GlobalStyle.tsx';
import { StyleSheetManager } from 'styled-components';

const isCrawler = () =>
  typeof navigator !== 'undefined' &&
  (navigator.userAgent.includes('Prerender') ||
    navigator.userAgent.includes('prerender'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StyleSheetManager disableCSSOMInjection={isCrawler()}>
      <GlobalStyle />
      <App />
    </StyleSheetManager>
  </StrictMode>,
);
