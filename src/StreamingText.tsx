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
  `;
  document.head.appendChild(el);
}

interface Token {
  key: number;
  text: string;
  delay: number;
}

function tokenize(
  text: string,
  keyRef: React.MutableRefObject<number>,
  stagger: number,
): Token[] {
  // Each match is a word with its surrounding whitespace, so stagger
  // is per-word (invisible whitespace doesn't waste a stagger slot).
  const words = text.match(/\s*\S+\s*/g);
  if (!words) return text ? [{ key: keyRef.current++, text, delay: 0 }] : [];
  return words.map((s, i) => ({
    key: keyRef.current++,
    text: s,
    delay: i * stagger,
  }));
}

interface StreamingTextProps {
  /** The text value to render. As this grows, new content fades in. */
  value: string | undefined;
  /** Set to false to disable the fade-in animation. */
  animate?: boolean;
  /** CSS animation duration. Default: '0.6s'. */
  duration?: string;
  /** Delay in ms between each word within a batch. Default: 30. */
  stagger?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function StreamingText({
  value,
  animate = true,
  duration = '0.6s',
  stagger = 30,
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
      const newTokens = tokenize(delta, nextKey, stagger);
      setTokens(existing => [...existing, ...newTokens]);
    } else {
      // Value appeared, was replaced, or was reset
      setTokens(text ? tokenize(text, nextKey, stagger) : []);
    }
  }, [value, stagger]);

  const baseStyle = useMemo<React.CSSProperties>(
    () => ({
      animationName: 'st-fadeIn',
      animationDuration: duration,
      animationTimingFunction: 'ease-in-out',
      animationFillMode: 'both',
      whiteSpace: 'pre-wrap',
    }),
    [duration],
  );

  const noAnimStyle = useMemo<React.CSSProperties>(
    () => ({ whiteSpace: 'pre-wrap' }),
    [],
  );

  return (
    <span className={className} style={style}>
      {tokens.map(token => (
        <span
          key={token.key}
          style={
            animate
              ? { ...baseStyle, animationDelay: `${token.delay}ms` }
              : noAnimStyle
          }
        >
          {token.text}
        </span>
      ))}
    </span>
  );
}
