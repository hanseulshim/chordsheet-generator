import { describe, it, expect } from 'vitest'
import { transposeChord, transposeChordPro } from './transposer'

describe('transposer - transposeChord', () => {
  it('should transpose basic chords', () => {
    expect(transposeChord('C', 2, 'standard', 'D')).toBe('D')
    expect(transposeChord('F', 2, 'standard', 'G')).toBe('G')
  })

  it('should handle flats and sharps according to target key', () => {
    // F + 1 step = F# or Gb. If target key is F, it's F#? Wait.
    // Well, a more clear example:
    expect(transposeChord('C', -1, 'standard', 'B')).toBe('B')
    expect(transposeChord('A', 3, 'standard', 'C')).toBe('C') 
  })

  it('should handle qualities and slash chords', () => {
    expect(transposeChord('G/B', 2, 'standard', 'A')).toBe('A/C#') // target A uses sharps
    expect(transposeChord('F#m7', -2, 'standard', 'E')).toBe('Em7')
  })

  it('should generate Nashville numbers', () => {
    const mode = 'nashville'
    expect(transposeChord('C', 0, mode, 'C')).toBe('I')
    expect(transposeChord('F', 0, mode, 'C')).toBe('IV')
    expect(transposeChord('G/B', 0, mode, 'C')).toBe('V/VII')
    
    // Transposed + Nashville
    // Original key C, Target is D. Chord is F -> +2 steps -> G. In key of D, G is IV.
    expect(transposeChord('F', 2, mode, 'D')).toBe('IV')
  })

  it('should generate Standard chords from Nashville input', () => {
    // Orig Key = D, Target Key = G. Nashville = IV. 
    // Absolute chord is G. In key of G, target is C.
    expect(transposeChord('IV', 5, 'standard', 'G', 'D')).toBe('C')
    expect(transposeChord('I/III', 0, 'standard', 'D', 'D')).toBe('D/F#')
    expect(transposeChord('vi', 2, 'standard', 'E', 'D')).toBe('C#m')
  })
})

describe('transposer - transposeChordPro', () => {
  it('should transpose an entire chordpro text', () => {
    const input = 'This is a [C]test [G/B]string [Am7]'
    const target = 'D'
    const orig = 'C'
    
    const output = transposeChordPro(input, orig, target, 'standard')
    expect(output).toBe('This is a [D]test [A/C#]string [Bm7]')
  })
})
