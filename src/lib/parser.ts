export function parseChordOverText(input: string): string {
  const lines = input.split('\n')
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
    const chordRegex = /^(b|#)?([A-G]|VII|VI|V|IV|III|II|I)(#|b)?(m|maj|min|dim|aug|sus|s)?\d*(\/(b|#)?([A-G]|VII|VI|V|IV|III|II|I)(#|b)?)?$/i
    
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
  
  // Very simplistic heuristic for the first 5 lines
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Check for explicit "Key:", "Artist:", "Tempo:", "Scan:"
    let matchedAny = false
    
    const artistMatch = line.match(/Artist:\s*([^|]+)/i)
    if (artistMatch) { meta.artist = artistMatch[1].trim(); matchedAny = true }
    
    const keyMatch = line.match(/Key:\s*([^|]+)/i)
    if (keyMatch) { meta.key = keyMatch[1].trim(); matchedAny = true }
    
    const tempoMatch = line.match(/Tempo:\s*([^|]+)/i)
    if (tempoMatch) { meta.tempo = tempoMatch[1].trim(); matchedAny = true }
    
    const scanMatch = line.match(/Scan:\s*(.+)/i)
    if (scanMatch) { meta.scan = scanMatch[1].trim(); matchedAny = true }

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
