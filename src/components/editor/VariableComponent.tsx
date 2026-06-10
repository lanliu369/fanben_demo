'use client';

import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';

export function VariableComponent({ node, selected }: NodeViewProps) {
  const { name, label } = node.attrs;

  return (
    <NodeViewWrapper
      as="span"
      className={`inline-flex items-center gap-1 mx-0.5 px-2 py-0.5 rounded-full text-xs font-mono border select-none cursor-default align-middle
        ${selected
          ? 'bg-blue-100 border-blue-400 text-blue-800 ring-2 ring-blue-300'
          : 'bg-blue-50 border-blue-200 text-blue-700'
        }`}
      contentEditable={false}
    >
      {`{{${name}}}`}
      {label && (
        <span className="font-sans text-blue-500 text-[10px] opacity-80">{label}</span>
      )}
    </NodeViewWrapper>
  );
}
