import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface StreamingTextProps {
  value: string | undefined;
  className?: string;
  style?: React.CSSProperties;
}

export function StreamingText({ value, className, style }: StreamingTextProps) {
  const [chunks, setChunks] = useState<Array<{ id: number; text: string }>>([]);
  const prevValue = useRef('');
  const nextId = useRef(0);

  useEffect(() => {
    const text = value ?? '';
    const prev = prevValue.current;
    if (text === prev) return;
    prevValue.current = text;

    if (prev.length > 0 && text.startsWith(prev)) {
      // Content was appended — animate only the new part
      const delta = text.slice(prev.length);
      setChunks(c => {
        const next = [...c, { id: nextId.current++, text: delta }];
        // Consolidate old chunks to keep the DOM light
        if (next.length > 10) {
          const settled = next.slice(0, -2).map(s => s.text).join('');
          return [{ id: next[0].id, text: settled }, ...next.slice(-2)];
        }
        return next;
      });
    } else {
      // Value appeared, was replaced, or was reset
      setChunks(text ? [{ id: nextId.current++, text }] : []);
    }
  }, [value]);

  return (
    <span className={className} style={style}>
      {chunks.map(chunk => (
        <motion.span
          key={chunk.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          {chunk.text}
        </motion.span>
      ))}
    </span>
  );
}
