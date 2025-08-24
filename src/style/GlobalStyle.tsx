// CSS Reset
import { createGlobalStyle } from 'styled-components';

export default createGlobalStyle`
  * {
    box-sizing: border-box;

    &:after, &:before {
      box-sizing: border-box;
    }
  }

  html,
  body {
    height: 100%;
    width: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
    line-height: 1;
    -webkit-tap-highlight-color: rgba(0,0,0,0);
    touch-action: manipulation;
    background-color: #ffffff;

    -webkit-text-size-adjust: none;
    touch-action: pan-y; /*prevent user scaling*/
  }

  body::-webkit-scrollbar { width: 0 !important }
  body { overflow: -moz-scrollbars-none; -ms-overflow-style: none; }

  body, textarea, input, button {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
    color: #111111;
  }

  #root {
    min-height: 100%;
    min-width: 100%;
  }

  button, input, textarea {
    outline: none;
    border: none;
    -webkit-appearance: none;
    background-color: transparent;
  }

  button {
    cursor: pointer;
    user-select: none;
    padding: 0;
    margin: 0;
  }

  a {
    text-decoration: none;

    &:hover {
      text-decoration: none;
    }

    &:active {
      text-decoration: none;
    }
  }

  textarea {
    resize: none;
  }

  input[type=number]::-webkit-inner-spin-button,
  input[type=number]::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  * {
    backface-visibility: hidden;
  }

  div {
    &:focus {
      outline: none;
    }
  }
`;
