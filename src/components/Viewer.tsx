import React, { useMemo, useEffect, useRef, useState } from 'react'
import { parseSectionsAndRoadmap } from '../lib/chordpro'
import { transposeChordPro } from '../lib/transposer'

interface ViewerProps {
  chordProText: string
  title: string
  artist: string
  tempo: string
  originalKey: string
  targetKey: string
  mode: 'standard' | 'nashville' | 'lyrics'
  customScan?: string
}

export function Viewer({ chordProText, title, artist, tempo, originalKey, targetKey, mode, customScan }: ViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Get the available width in the viewing container (minus padding)
        const availableWidth = entry.contentRect.width - 32 // 16px padding on each side roughly
        if (availableWidth < 850 && availableWidth > 0) {
          setScale(availableWidth / 850)
        } else {
          setScale(1)
        }
      }
    })
    
    if (containerRef.current) {
      observer.observe(containerRef.current)
    }
    
    return () => observer.disconnect()
  }, [])

  const { renderedContent, roadmap } = useMemo(() => {
    try {
      // 1. Transpose
      let processedText = chordProText
      if (originalKey && targetKey && mode !== 'lyrics') {
        processedText = transposeChordPro(chordProText, originalKey, targetKey, mode)
      }
      
      // 2. Parse sections
      const { finalChordPro, roadmap } = parseSectionsAndRoadmap(processedText)
      
      // 3. Convert to React elements
      return { renderedContent: renderChordProToReact(finalChordPro, mode), roadmap }
    } catch (err) {
      console.error(err)
      return { renderedContent: <div className="text-red-500">Error rendering chord sheet.</div>, roadmap: [] }
    }
  }, [chordProText, originalKey, targetKey, mode])

  return (
    <div ref={containerRef} className="print-viewer print:p-0 print:overflow-visible print:bg-white h-full overflow-y-auto overflow-x-hidden bg-slate-200/80 p-4 pt-4 md:pt-6 md:p-8 flex flex-col items-center">
      <div 
        style={{ 
          transform: `scale(${scale})`, 
          transformOrigin: 'top center',
          marginBottom: scale < 1 ? `-${(1 - scale) * 1100}px` : '4rem'
        }}
        className="print:transform-none print:m-0 print:min-h-0 print:w-full print:border-none print:shadow-none print:ring-0 w-[850px] h-[1100px] shrink-0 bg-white px-6 pb-6 md:px-10 md:pb-10 pt-4 md:pt-6 print:pt-4 shadow-2xl ring-1 ring-slate-900/5 transition-transform duration-75 ease-out flex flex-col"
      >
        <div className="flex-1 flex flex-col space-y-4 font-mono text-[12px] tracking-tight leading-relaxed text-slate-800 min-h-0">
          {/* Header Block */}
          <div className="shrink-0 mb-2 pb-2 print:mb-2">
            <h1 className="text-2xl print:text-xl font-bold font-sans text-slate-900 tracking-tight">
              {title || 'Untitled Song'}
            </h1>
            <p className="mt-1 font-sans font-medium text-slate-500">
              Artist: <span className="text-slate-700">{artist || 'Unknown'}</span> &nbsp;|&nbsp; Key: <span className="text-slate-700">{targetKey || originalKey}</span> &nbsp;|&nbsp; Tempo: <span className="text-slate-700">{tempo || '--'}</span>
            </p>
            {(customScan || (roadmap && roadmap.length > 0)) && (
              <p className="mt-2 font-bold tracking-widest text-slate-400 uppercase">
                SCAN: <span className="text-indigo-600 print:text-slate-600">{customScan || roadmap.map(r => r.label).join(' • ')}{!customScan && ''}</span>
              </p>
            )}
          </div>
          
          {/* Content Block */}
          <div className="flex-1 min-h-0">
            <div className="h-full columns-1 md:columns-2 gap-12 text-left" style={{ columnFill: 'auto' }}>
              {renderedContent}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function renderChordProToReact(text: string, mode: 'standard' | 'nashville' | 'lyrics') {
  const lines = text.split('\n')
  
  return (() => {
    const blocks: React.ReactNode[][] = []
    let currentBlock: React.ReactNode[] = []

    lines.forEach((line, lineIndex) => {
      // Check for section markers
      if (line.match(/^{so[cv]}/)) return
      if (line.match(/^{eo[cv]}/)) return

      if (line.trim() === '') {
        if (currentBlock.length > 0) {
          blocks.push(currentBlock)
          currentBlock = []
        }
        return
      }

      // Heuristic: If it looks like a section header (all caps or starts with Verse/Chorus)
      if (line.match(/^(verse|chorus|bridge|intro|outro|interlude)/i) || (line.trim() === line.trim().toUpperCase() && line.trim().length > 2 && line.trim().length < 20 && !line.includes('['))) {
        if (currentBlock.length > 0) {
          blocks.push(currentBlock)
          currentBlock = []
        }
        
        const isIntro = line.match(/^intro/i)
        const isFirstBlock = blocks.length === 0
        currentBlock.push(
          <h3 key={lineIndex} className={`${(isIntro || isFirstBlock) ? 'mt-0' : 'mt-4'} mb-1 font-bold text-slate-800 uppercase tracking-widest text-[12px] break-after-avoid`}>
            {line.replace(/:/g, '')}
          </h3>
        )
        return
      }

      if (!line.includes('[')) {
        // Plain lyric
        currentBlock.push(<div key={lineIndex} className="min-h-[1.5rem]">{line}</div>)
        return
      }

      // Line with chords
      const isOnlyChords = !line.replace(/\[[^\]]+\]/g, '').trim()
      
      // Skip entire line if it's pure chords and we are in lyrics mode
      if (isOnlyChords && mode === 'lyrics') return

      const parts = line.split(/(\[[^[\]]+\])/g)
      
      currentBlock.push(
        <div key={lineIndex} className={`relative flex whitespace-nowrap leading-tight ${isOnlyChords ? 'mt-1 mb-1' : 'mt-5'}`}>
          {parts.map((part, i) => {
            if (part.startsWith('[') && part.endsWith(']')) {
              if (mode === 'lyrics') return null
              
              const chord = part.slice(1, -1)
              
              if (isOnlyChords) {
                return (
                  <span key={i} className="font-bold text-indigo-600 inline-block">
                    {chord}
                  </span>
                )
              }

              return (
                <span key={i} className="relative inline-flex flex-col-reverse justify-end">
                  {/* The invisible spacer ensures words don't get squished if the chord is very long and has no lyrics under it */}
                  <span className="invisible w-0">&#8203;</span>
                  <span className="absolute -top-[1.2em] whitespace-nowrap font-bold text-indigo-600">
                    {chord}
                  </span>
                  {/* If the user put a chord with no succeeding text, we need structural space */}
                  {i === parts.length - 1 && <span className="invisible whitespace-nowrap">{chord}</span>}
                </span>
              )
            }
            return <span key={i} className="whitespace-pre">{part}</span>
          })}
        </div>
      )
    })

    if (currentBlock.length > 0) {
      blocks.push(currentBlock)
    }

    return blocks.map((block, i) => (
      <div key={i} className="break-inside-avoid">
        {block}
      </div>
    ))
  })()
}
