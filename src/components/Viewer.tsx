import { useMemo, useEffect, useRef, useState } from 'react'
import { parseSectionsAndRoadmap, abbreviateScanLabel } from '../lib/chordpro'
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
  fontSize?: number
  onRoadmapChange?: (scan: string) => void
}

export function Viewer({ chordProText, title, artist, tempo, originalKey, targetKey, mode, customScan, fontSize = 12, onRoadmapChange }: ViewerProps) {
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

  const { pages, roadmap } = useMemo(() => {
    try {
      // 1. Transpose
      let processedText = chordProText
      if (originalKey && targetKey && mode !== 'lyrics') {
        processedText = transposeChordPro(chordProText, originalKey, targetKey, mode)
      }
      
      // 2. Parse sections
      const { finalChordPro, roadmap } = parseSectionsAndRoadmap(processedText)
      
      // 3. Convert to Multi-Page Blocks
      const lines = finalChordPro.split('\n')
      
      interface ParsedBlock {
        reactNode: React.ReactNode;
        pixelHeight: number;
      }
      
      const blocks: ParsedBlock[] = []
      let currentBlock: React.ReactNode[] = []
      let currentPixelHeight = 0
      
      const lineHeightTight = fontSize * 1.25 // leading-tight

      lines.forEach((line, lineIndex) => {
        // Ignore structural tags
        if (line.match(/^{so[cv]}/)) return
        if (line.match(/^{eo[cv]}/)) return

        if (line.trim() === '') {
          // End block
          if (currentBlock.length > 0) {
            blocks.push({ reactNode: <div key={`block-${lineIndex}`} className="break-inside-avoid">{currentBlock}</div>, pixelHeight: currentPixelHeight })
            currentBlock = []
            currentPixelHeight = 0
          }
          return
        }

        const pureLine = line.replace(/[[\]:]/g, '').trim()
        const isHeader = pureLine.match(/^(verse|chorus|bridge|intro|outro|interlude|tag|vamp|instrumental)/i) || 
                         (pureLine === pureLine.toUpperCase() && pureLine.length > 2 && pureLine.length < 20 && (!line.includes('[') || (line.trim().startsWith('[') && line.trim().endsWith(']'))))
        
        if (isHeader) {
          if (currentBlock.length > 0) {
            blocks.push({ reactNode: <div key={`block-${lineIndex}`} className="break-inside-avoid">{currentBlock}</div>, pixelHeight: currentPixelHeight })
            currentBlock = []
            currentPixelHeight = 0
          }
          
          const isIntro = pureLine.match(/^intro/i)
          const isFirstBlock = blocks.length === 0
          const bumpTop = (isIntro || isFirstBlock) ? 0 : 16 // mt-4 = 16px
          currentPixelHeight += fontSize * 1.5 + bumpTop
          
          currentBlock.push(
            <h3 key={lineIndex} className={`${(isIntro || isFirstBlock) ? 'mt-0' : 'mt-4'} font-bold text-slate-800 uppercase tracking-widest break-after-avoid`}>{pureLine}</h3>
          )
          return
        }

        if (!line.includes('[')) {
          currentPixelHeight += 16 // min-h-[1rem] = 16px
          currentBlock.push(<div key={lineIndex} className="min-h-[1rem]">{line}</div>)
          return
        }

        const isOnlyChords = !line.replace(/\[[^\]]+\]/g, '').trim()
        const parts = line.split(/(\[[^[\]]+\])/g)

        const suppressChords = mode === 'lyrics'

        // Ignore N.C. (No Chord), Lyrics mode
        if (isOnlyChords && (suppressChords || parts.every(p => !p.startsWith('[') || p.toUpperCase() === '[N.C.]' || p.toUpperCase() === '[NC]'))) return
        currentPixelHeight += isOnlyChords ? (lineHeightTight + 8) : (lineHeightTight + 20)
        
        currentBlock.push(
          <div key={lineIndex} className={`relative flex whitespace-nowrap leading-tight ${isOnlyChords ? 'mt-1 mb-1' : 'mt-4'}`}>
            {parts.map((part, i) => {
              if (part.startsWith('[') && part.endsWith(']')) {
                if (suppressChords) return null
                const chord = part.slice(1, -1)
                
                // Drop N.C. symbols dynamically
                if (chord.toUpperCase() === 'N.C.' || chord.toUpperCase() === 'NC') return null
                
                if (isOnlyChords) {
                  return (
                    <span key={i} className="font-bold text-indigo-600 print:text-black inline-block pr-1">
                      {chord}
                    </span>
                  )
                }
                return (
                  <span key={i} className="relative inline-block h-4 align-bottom">
                    <span className="absolute -top-[1.2em] left-0 whitespace-nowrap font-bold text-indigo-600 print:text-black leading-none">
                      {chord}
                    </span>
                  </span>
                )
              }
              return <span key={i} className="whitespace-pre">{part}</span>
            })}
          </div>
        )
      })

      if (currentBlock.length > 0) {
        blocks.push({ reactNode: <div key="block-last" className="break-inside-avoid">{currentBlock}</div>, pixelHeight: currentPixelHeight })
      }

      // Pagination Matrix: Pages[Page][Column][Block]
      const layoutPages: React.ReactNode[][][] = []
      let currentPage: React.ReactNode[][] = [[], []]
      let currentCol = 0
      let currentHeight = 0

      blocks.forEach(block => {
        const isFirstPage = layoutPages.length === 0
        // Calculate max pixel height visually available for actual columns layout
        // 1100 total - 56px (pt-4, pb-10) - 70px (title block) = ~974. Use 970 and 1040 buffer
        const maxAvailable = isFirstPage ? 970 : 1040

        if (currentHeight + block.pixelHeight > maxAvailable && currentHeight > 0) {
          currentCol++
          currentHeight = 0
          if (currentCol > 1) {
            layoutPages.push(currentPage)
            currentPage = [[], []]
            currentCol = 0
          }
        }
        currentPage[currentCol].push(block.reactNode)
        currentHeight += block.pixelHeight
      })
      layoutPages.push(currentPage)

      return { pages: layoutPages, roadmap }
    } catch (err) {
      console.error(err)
      return { pages: [[ [<div className="text-red-500">Error</div>], [] ]], roadmap: [] }
    }
  }, [chordProText, originalKey, targetKey, mode, fontSize])

  useEffect(() => {
    if (onRoadmapChange && roadmap) {
      onRoadmapChange(roadmap.map(r => abbreviateScanLabel(r.label)).join('. ') + '.')
    }
  }, [roadmap, onRoadmapChange])

  return (
    <div ref={containerRef} className="print-viewer print:p-0 print:block print:overflow-visible print:bg-white min-h-full bg-slate-200/80 p-4 pt-4 md:pt-6 md:p-8 flex flex-col items-center">
      {pages.map((page, pageIndex) => (
        <div 
          key={pageIndex}
          style={{ 
            transform: `scale(${scale})`, 
            transformOrigin: 'top center',
            marginBottom: `calc(${(scale - 1) * 1100}px + 2.5rem)`,
            willChange: 'transform'
          }}
          className={`print-page ${pageIndex < pages.length - 1 ? 'print:break-after-page' : ''} w-[850px] h-[1100px] shrink-0 bg-white px-6 pb-6 md:px-10 md:pb-10 pt-4 md:pt-6 shadow-lg ring-1 ring-slate-900/5 flex flex-col relative overflow-hidden`}
        >
          <div className="flex-1 flex flex-col space-y-4 font-mono tracking-tight leading-relaxed text-slate-800 print:text-black min-h-0" style={{ fontSize: `${fontSize}px` }}>
            {/* Header Block (Only rendered on the very first physical page) */}
            {pageIndex === 0 && (
              <div className="shrink-0 mb-1 pb-1 print:mb-1">
                <h1 className="font-bold font-sans text-slate-900 print:text-black tracking-tight" style={{ fontSize: `${fontSize * 1.6}px`, lineHeight: 1.2 }}>
                  {title || 'Untitled Song'}
                </h1>
                <div className="mt-1 flex items-center gap-2 text-slate-500 print:text-black font-sans" style={{ fontSize: `${fontSize * 0.85}px` }}>
                  <span>Artist: <span className="text-slate-700 print:text-black font-medium">{artist || 'Unknown'}</span></span>
                  <span className="text-slate-300 mx-1 print:hidden">•</span>
                  <span>Key: <span className="text-slate-700 print:text-black font-medium">{targetKey || originalKey}</span></span>
                  <span className="text-slate-300 mx-1 print:hidden">•</span>
                  <span>Tempo: <span className="text-slate-700 print:text-black font-medium">{tempo || '--'}</span></span>
                </div>
                {(customScan || (roadmap && roadmap.length > 0)) && (
                  <p className="mt-2 font-bold tracking-widest text-slate-400 print:text-black uppercase">
                    <span className="text-slate-500 print:text-black">SCAN:</span> <span className="text-indigo-600 print:text-black">{customScan || roadmap.map(r => abbreviateScanLabel(r.label)).join('. ') + '.'}</span>
                  </p>
                )}
              </div>
            )}
            
            {/* Content Block */}
            <div className="flex-1 flex gap-12 text-left min-h-0 w-full h-full">
              <div className="flex-1 flex flex-col min-h-0">{page[0]}</div>
              <div className="flex-1 flex flex-col min-h-0">{page[1]}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
