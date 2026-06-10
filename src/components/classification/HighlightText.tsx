'use client';

import { useMemo } from 'react';
import { splitHighlightSegments } from '@/lib/classification/highlight';

type Props = {
  text: string;
  query?: string;
  className?: string;
};

export function HighlightText({ text, query, className }: Props) {
  const parts = useMemo(() => splitHighlightSegments(text, query ?? ''), [text, query]);
  if (!query?.trim()) {
    return <span className={className}>{text}</span>;
  }
  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.match ? (
          <mark
            key={i}
            className="bg-amber-200/90 text-slate-900 rounded-sm px-0.5 font-inherit"
          >
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </span>
  );
}
