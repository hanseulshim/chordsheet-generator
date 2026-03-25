export type Mode = 'standard' | 'nashville' | 'compact'

const KEYS_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const KEYS_FLAT  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'Cb']

// Nashville numerals for the major scale: 1, 2m, 3m, 4, 5, 6m, 7dim
// For simplicity, we just use I, II, III, IV, V, VI, VII and keep their qualities (m, maj, etc)
// from the original chord. 
// Note: standard Nashville indicates quality by casing (ii vs II), but typically we just supply
// the root as Roman and attach the suffix.
const NASHVILLE_ROOTS = ['I', 'bII', 'II', 'bIII', 'III', 'IV', 'bV', 'V', 'bVI', 'VI', 'bVII', 'VII']

// Heuristic to decide if a key generally uses sharps or flats for its scale
const FLAT_KEYS = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']

function normalizeRoot(root: string): { index: number, isFlat: boolean } {
  // Let's find its semitone index (0 to 11)
  let idx = KEYS_SHARP.indexOf(root)
  let isFlat = false
  if (idx === -1) {
    idx = KEYS_FLAT.indexOf(root)
    isFlat = true
  }
  return { index: idx, isFlat }
}

function parseNashvilleRoot(chord: string): { index: number, quality: string } | null {
  const match = chord.match(/^(b|#)?(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)(.*)$/i)
  if (!match) return null

  const prefix = match[1] || '' 
  const roman = match[2].toUpperCase() 
  let rest = match[3] || '' 

  // if the original was lowercase and rest doesn't start with 'm', it's inherently minor
  if (match[2] === match[2].toLowerCase() && !rest.toLowerCase().startsWith('m') && !rest.toLowerCase().startsWith('dim')) {
    rest = 'm' + rest
  }

  let numeralStr = prefix + roman
  if (numeralStr === '#I') numeralStr = 'bII'
  if (numeralStr === '#II') numeralStr = 'bIII'
  if (numeralStr === '#III') numeralStr = 'IV'
  if (numeralStr === '#IV') numeralStr = 'bV'
  if (numeralStr === '#V') numeralStr = 'bVI'
  if (numeralStr === '#VI') numeralStr = 'bVII'
  if (numeralStr === '#VII') numeralStr = 'I'

  const idx = NASHVILLE_ROOTS.indexOf(numeralStr)
  if (idx === -1) return null

  return { index: idx, quality: rest }
}

export function transposeChord(chord: string, steps: number, mode: Mode = 'standard', targetKey: string = 'C', originalKey: string = 'C'): string {
  // Handle slash chords
  if (chord.includes('/')) {
    const parts = chord.split('/')
    return parts.map(p => transposeChord(p, steps, mode, targetKey, originalKey)).join('/')
  }

  const targetInfo = normalizeRoot(targetKey)
  const origInfo = normalizeRoot(originalKey)

  let absoluteIndex = -1
  let chordQuality = ''

  const stdMatch = chord.match(/^([A-G][#b]?)(.*)$/)
  
  if (stdMatch) {
    const root = stdMatch[1]
    chordQuality = stdMatch[2] || ''
    absoluteIndex = normalizeRoot(root).index
  } else {
    const nash = parseNashvilleRoot(chord)
    if (nash && origInfo.index !== -1) {
      absoluteIndex = (origInfo.index + nash.index) % 12
      chordQuality = nash.quality
    }
  }

  if (absoluteIndex === -1) return chord 

  let newIndex = (absoluteIndex + steps) % 12
  if (newIndex < 0) newIndex += 12

  if (mode === 'nashville') {
    if (targetInfo.index === -1) return chord 

    let degree = (newIndex - targetInfo.index) % 12
    if (degree < 0) degree += 12

    return NASHVILLE_ROOTS[degree] + chordQuality
  } else {
    const useFlats = FLAT_KEYS.includes(targetKey)
    const newRoot = useFlats ? KEYS_FLAT[newIndex] : KEYS_SHARP[newIndex]
    return newRoot + chordQuality
  }
}

export function transposeChordPro(chordPro: string, originalKey: string, targetKey: string, mode: Mode = 'standard'): string {
  const origInfo = normalizeRoot(originalKey)
  const targetInfo = normalizeRoot(targetKey)

  if (origInfo.index === -1 || targetInfo.index === -1) return chordPro

  let steps = targetInfo.index - origInfo.index

  // Match anything inside brackets [C#m7]
  return chordPro.replace(/\[([^\]]+)\]/g, (match, chordGroup) => {
    // Multiple chords could theoretically be inside but typically it's just one chord
    // like [G/B]
    const transposed = transposeChord(chordGroup, steps, mode, targetKey, originalKey)
    return `[${transposed}]`
  })
}
