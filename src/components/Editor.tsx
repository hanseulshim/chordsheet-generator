import React from 'react'

interface EditorProps {
  value: string
  onChange: (val: string) => void
  onStandardizeRequested: (newText: string) => void
}

export function Editor({ value, onChange, onStandardizeRequested }: EditorProps) {
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    const pastedText = e.clipboardData.getData('text')
    const target = e.target as HTMLTextAreaElement
    const start = target.selectionStart ?? 0
    const end = target.selectionEnd ?? 0
    
    const newText = value.slice(0, start) + pastedText + value.slice(end)
    onStandardizeRequested(newText)
  }

  return (
    <div className="flex h-full flex-col font-mono text-sm leading-relaxed overflow-hidden bg-white">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={handlePaste}
        className="flex-1 resize-none bg-white p-6 text-slate-800 focus:outline-none"
        placeholder="Type or paste your chords here... e.g. [G]Hello there"
        spellCheck={false}
      />
    </div>
  )
}
