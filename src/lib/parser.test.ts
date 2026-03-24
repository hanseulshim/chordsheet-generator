import { describe, it, expect } from 'vitest'
import { parseChordOverText } from './parser'

describe('parser - parseChordOverText', () => {
  it('should convert standard chord-over-text to ChordPro', () => {
    const input = `
G           D
Hello there my friend
Em              C
How are you today?
    `
    const result = parseChordOverText(input)
    expect(result.trim()).toContain('[G]Hello there [D]my friend')
    expect(result.trim()).toContain('[Em]How are you toda[C]y?')
  })

  it('should recognize and ignore noise lines', () => {
    const input = `
Capo 2
G  D
Words here
    `
    const result = parseChordOverText(input)
    expect(result).toContain('Capo 2')
    expect(result).toContain('[G]Wor[D]ds here')
  })

  it('should recognize Nashville/Roman Numeral chords', () => {
    const input = `
I vi Vs V
This is a test line
    `
    const result = parseChordOverText(input)
    expect(result.trim()).toContain('[I]Th[vi]is [Vs]is [V]a test line')
  })
})
