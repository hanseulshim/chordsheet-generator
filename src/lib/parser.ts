export function parseChordOverText(input: string): string {
  const rawLines = input.split('\n')
  const lines: string[] = []
  let skippingChordsBlock = false

  // 1. Initial cleanup of Ultimate Guitar artifacts and normalization
  for (let line of rawLines) {
    if (line.match(/^Page \d+\/\d+/)) continue
    if (line.match(/^(Difficulty|Tuning):/i)) continue
    
    // Catch the UG "Chords" block which is just a useless list of chords used
    if (line.trim() === 'Chords') {
      skippingChordsBlock = true
      continue
    }
    
    if (skippingChordsBlock) {
      if (line.trim() === '' || line.startsWith('[')) {
        skippingChordsBlock = false
      } else {
        continue // Skip this chord definition
      }
    }

    // UG bracketed sections like [Verse 1] -> convert to VERSE 1:
    const sectionMatch = line.match(/^\[(.*?)\]$/)
    if (sectionMatch) {
      // Validate it's a section and not an actual bracketed chord
      const inner = sectionMatch[1]
      const isKnownHeader = inner.match(/^(verse|chorus|bridge|intro|outro|interlude|tag|vamp|instrumental)/i)
      const isUnknownNonChord = inner.length > 2 && !inner.match(/^[A-G][#b]?(m|maj|min|dim|aug|sus)?\d*(\/.*)?$/i)
      
      if (isKnownHeader || isUnknownNonChord) {
        lines.push(`${inner.toUpperCase()}:`)
        continue
      }
    }
    
    lines.push(line)
  }

  const result: string[] = []

  // Simple heuristic: A line is considered a chord line if it's mostly whitespace
  // and contains typical chord words.
  const isChordLine = (line: string) => {
    if (!line.trim()) return false
    
    // Check if it's a metadata noise line
    const lower = line.toLowerCase().trim()
    if (lower.startsWith('capo') || lower.startsWith('intro') || lower.match(/^(verse|chorus|bridge)/)) {
      return false
    }

    const tokens = line.split(/\s+/).filter(Boolean)
    // Extended to match N.C. (No Chord) which is heavily used in UG
    const chordRegex = /^(N\.C\.|(b|#)?([A-G]|VII|VI|V|IV|III|II|I)(#|b)?(m|maj|min|dim|aug|sus|s)?\d*(\/(b|#)?([A-G]|VII|VI|V|IV|III|II|I)(#|b)?)?)$/i
    
    // If all tokens look like chords, it's a chord line
    let chordScore = 0
    for (const t of tokens) {
      if (chordRegex.test(t)) {
        chordScore++
      }
    }
    
    // If more than 50% of tokens look like chords, consider it a chord line
    return tokens.length > 0 && (chordScore / tokens.length) >= 0.5
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // The user explicitly requested to completely strip and ignore N.C. markers so they don't even reach the Editor text box
    const cleanLine = line.trim().toUpperCase()
    if (cleanLine === 'N.C.' || cleanLine === 'NC') continue

    if (isChordLine(line)) {
      // Look ahead to see if the next line is lyrics to attach to 
      // or if it's just chords on its own
      const nextLine = (i + 1 < lines.length) ? lines[i + 1] : null

      if (nextLine !== null && nextLine.trim() !== '' && !isChordLine(nextLine)) {
        // Merge chords into the next line lyrics
        result.push(mergeChordsIntoLyrics(line, nextLine))
        i++ // Skip the lyric line since we merged it
      } else {
        // Just standalone chords, wrap them in brackets or keep as is?
        // Let's just wrap each valid chord token in []
        const standaloneChords = line.replace(/(\S+)/g, '[$1]')
        result.push(standaloneChords)
      }
    } else {
      result.push(line)
    }
  }

  return result.join('\n')
}

// Helper to inject chords into lyric string at exact character indices based on spacing
function mergeChordsIntoLyrics(chordLine: string, lyricLine: string): string {
  const chordMatches = [...chordLine.matchAll(/\S+/g)]
  
  if (chordMatches.length === 0) return lyricLine

  // We need to inject backwards so that we don't mess up the indices
  // for subsequent injections.
  let merged = lyricLine
  for (let idx = chordMatches.length - 1; idx >= 0; idx--) {
    const match = chordMatches[idx]
    const chord = match[0]
    const pos = match.index!
    
    // If the lyric line is shorter than the chord position, pad it
    if (pos > merged.length) {
      merged = merged.padEnd(pos, ' ') + `[${chord}]`
    } else {
      merged = merged.slice(0, pos) + `[${chord}]` + merged.slice(pos)
    }
  }
  
  return merged
}

export interface SongMetadata {
  title?: string
  artist?: string
  key?: string
  tempo?: string
  scan?: string
  remainingText: string
}

export function extractMetadata(input: string): SongMetadata {
  const meta: SongMetadata = { remainingText: input }
  const lines = input.split('\n')
  
  let contentStartIndex = 0
  
  // Very simplistic heuristic for the first 8 lines
  for (let i = 0; i < Math.min(8, lines.length); i++) {
    const line = lines[i].trim()
    if (!line) continue

    let matchedAny = false
    
    // Ultimate Guitar Title & Artist heuristic
    const ugMatch = line.match(/(.*?) Chords by (.*)/i)
    if (ugMatch && !meta.title) {
      meta.title = ugMatch[1].trim()
      meta.artist = ugMatch[2].trim()
      matchedAny = true
    }

    const artistMatch = line.match(/Artist:\s*([^|]+)/i)
    if (artistMatch) { meta.artist = artistMatch[1].trim(); matchedAny = true }
    
    const keyMatch = line.match(/Key:\s*([^|]+)/i)
    if (keyMatch) { meta.key = keyMatch[1].trim(); matchedAny = true }
    
    const tempoMatch = line.match(/Tempo:\s*([^|]+)/i)
    if (tempoMatch) { meta.tempo = tempoMatch[1].trim(); matchedAny = true }
    
    const scanMatch = line.match(/Scan:\s*(.+)/i)
    if (scanMatch) { meta.scan = scanMatch[1].trim(); matchedAny = true }

    // Strip UG noise from metadata capture block so it doesn't bleed
    if (line.match(/^(Difficulty|Tuning):/i)) matchedAny = true

    // If it's the very first line, has no standard tags, and isn't empty, guess it's the Title
    if (i === 0 && !matchedAny && !line.includes(':') && line.length > 2 && line.length < 50) {
      meta.title = line
      matchedAny = true
    }
    
    if (matchedAny) {
      contentStartIndex = i + 1
    }
  }

  meta.remainingText = lines.slice(contentStartIndex).join('\n').trim()
  return meta
}

// Compact Transform: rewrites the chordsheet text in-place
// - Identical sections (same chords + same lyrics) → completely removed
// - Same chords, different lyrics → chord annotations stripped from those lines
export function compactChordPro(text: string): string {
  const lines = text.split('\n')

  const extractChords = (line: string) =>
    (line.match(/\[([^\]]+)\]/g) || []).map(m => m.slice(1, -1).toUpperCase())
  
  const isHeaderLine = (line: string) => {
    const p = line.replace(/[[\]:]/g, '').trim()
    return !!(p.match(/^(verse|chorus|bridge|intro|outro|interlude|tag|vamp|instrumental)/i) ||
      (p === p.toUpperCase() && p.length > 2 && p.length < 20 &&
        (!line.includes('[') || (line.trim().startsWith('[') && line.trim().endsWith(']')))))
  }

  // Pass 1: chunk into sections
  interface Section { key: string; lineIndices: number[] }
  const sections: Section[] = []
  let current: Section | null = null
  lines.forEach((line, idx) => {
    if (isHeaderLine(line)) {
      if (current) sections.push(current)
      const label = line.replace(/[[\]:]/g, '').trim().replace(/\s+\d+$/, '').toUpperCase()
      current = { key: label, lineIndices: [idx] }
    } else if (current) {
      current.lineIndices.push(idx)
    }
  })
  if (current) sections.push(current)

  // Pass 2: build fingerprints and classify
  interface SeenRecord { chordFp: string; lyricFp: string }
  const seen = new Map<string, SeenRecord>()
  type LineAction = 'keep' | 'drop' | 'strip-chords'
  const lineAction: LineAction[] = new Array(lines.length).fill('keep')

  sections.forEach(sec => {
    const chords: string[] = []
    const lyrics: string[] = []
    sec.lineIndices.forEach(i => {
      chords.push(...extractChords(lines[i]))
      const stripped = lines[i].replace(/\[[^\]]+\]/g, '').trim()
      if (stripped) lyrics.push(stripped.toLowerCase())
    })
    const chordFp = [...new Set(chords)].sort().join('|')
    const lyricFp = lyrics.join('↵')

    const existing = seen.get(sec.key)
    if (existing) {
      if (existing.chordFp === chordFp && existing.lyricFp === lyricFp) {
        // Identical (chords + lyrics) — drop entire section
        sec.lineIndices.forEach(i => { lineAction[i] = 'drop' })
      } else if (existing.chordFp === chordFp) {
        // Exact same chords, different lyrics — strip chords from body lines
        sec.lineIndices.slice(1).forEach(i => { lineAction[i] = 'strip-chords' })
      }
      // Different chords → leave untouched
    } else {
      seen.set(sec.key, { chordFp, lyricFp })
    }
  })

  // Pass 3: build output
  const out: string[] = []
  lines.forEach((line, i) => {
    const action = lineAction[i]
    if (action === 'drop') return
    if (action === 'strip-chords') {
      const isOnlyChords = !line.replace(/\[[^\]]+\]/g, '').trim()
      if (isOnlyChords) return // drop pure-chord lines  
      // Strip inline chord annotations from mixed lyric lines
      out.push(line.replace(/\[[^\]]+\]/g, ''))
    } else {
      out.push(line)
    }
  })

  return out.join('\n')
}
