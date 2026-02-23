import { useEffect, useMemo, useRef, useState } from 'react';

// Inject animation keyframes once
const STYLE_ID = 'streaming-text-styles';
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = `
    @keyframes st-fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes st-blurIn {
      from { opacity: 0; filter: blur(4px); }
      to { opacity: 1; filter: blur(0); }
    }
  `;
  document.head.appendChild(el);
}

interface Token {
  key: number;
  text: string;
}

function tokenize(
  text: string,
  keyRef: React.MutableRefObject<number>,
): Token[] {
  return text
    .split(/(\s+)/)
    .filter(s => s.length > 0)
    .map(s => ({ key: keyRef.current++, text: s }));
}

interface StreamingTextProps {
  /** The text value to render. As this grows, new content animates in. */
  value: string | undefined;
  /** Animation effect. Default: 'fadeIn'. Set to null to disable. */
  animation?: 'fadeIn' | 'blurIn' | null;
  /** CSS animation duration. Default: '0.4s'. */
  duration?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function StreamingText({
  value,
  animation = 'fadeIn',
  duration = '0.4s',
  className,
  style,
}: StreamingTextProps) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const prevValue = useRef('');
  const nextKey = useRef(0);

  useEffect(() => {
    injectStyles();
  }, []);

  useEffect(() => {
    const text = value ?? '';
    const prev = prevValue.current;
    if (text === prev) return;
    prevValue.current = text;

    if (prev.length > 0 && text.startsWith(prev)) {
      // Content was appended — tokenize and animate only the delta
      const delta = text.slice(prev.length);
      const newTokens = tokenize(delta, nextKey);
      setTokens(existing => [...existing, ...newTokens]);
    } else {
      // Value appeared, was replaced, or was reset
      setTokens(text ? tokenize(text, nextKey) : []);
    }
  }, [value]);

  // Shared style object — stable across renders unless props change.
  // CSS animations only fire on mount, so existing tokens won't replay.
  const tokenStyle = useMemo<React.CSSProperties>(
    () =>
      animation
        ? {
            animationName: `st-${animation}`,
            animationDuration: duration,
            animationTimingFunction: 'ease-out',
            animationFillMode: 'both',
            whiteSpace: 'pre-wrap',
          }
        : { whiteSpace: 'pre-wrap' },
    [animation, duration],
  );

  return (
    <span className={className} style={style}>
      {tokens.map(token => (
        <span key={token.key} style={tokenStyle}>
          {token.text}
        </span>
      ))}
    </span>
  );
}
