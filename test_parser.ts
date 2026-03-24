import { parseChordOverText } from './src/lib/parser'
import * as fs from 'fs'

const text = `
I/III IV I V
For my life is wholly bound to his
`

console.log(parseChordOverText(text.trim()))
