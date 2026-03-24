import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { useState } from 'react'
import { Editor } from '../components/Editor'
import { Viewer } from '../components/Viewer'
import { extractMetadata, parseChordOverText } from '../lib/parser'

const searchSchema = z.object({
  key: z.string().optional().catch('C'),
  mode: z.enum(['standard', 'nashville', 'lyrics']).optional().catch('standard'),
  capo: z.number().optional().catch(0),
})

export const Route = createFileRoute('/')({
  component: App,
  validateSearch: searchSchema,
})

const DEFAULT_CHORDPRO = `VERSE 1:
[G]Amazing [D]Grace, how [Em]sweet the [C]sound
That [G]saved a [Em]wretch like [D]me
I [G]once was [D]lost but [Em]now am [C]found
Was [G]blind, but [D]now I [G]see

CHORUS:
[C]Hallelujah
[G]Grace like rain falls down on [D]me
[C]Hallelujah
[G]Grace like rain falls [D]down on [G]me
`

const KEYS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

const shadcnInput = "flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50"

function App() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  
  const [text, setText] = useState(DEFAULT_CHORDPRO)
  const [title, setTitle] = useState('Amazing Grace')
  const [artist, setArtist] = useState('John Newton')
  const [originalKey, setOriginalKey] = useState('G')
  const [tempo, setTempo] = useState('Slow')
  const [scanOverride, setScanOverride] = useState('')

  const setKey = (newKey: string) => {
    navigate({ search: { ...search, key: newKey } })
  }


  const handleStandardize = (input: string) => {
    const meta = extractMetadata(input)
    if (meta.title) setTitle(meta.title)
    if (meta.artist) setArtist(meta.artist)
    if (meta.key) setOriginalKey(meta.key)
    if (meta.tempo) setTempo(meta.tempo)
    if (meta.scan) setScanOverride(meta.scan)
    
    const parsed = parseChordOverText(meta.remainingText)
    setText(parsed)
  }

  return (
    <main className="flex h-screen w-full flex-col overflow-hidden bg-slate-50 text-slate-800">
      
      {/* Top Navigation / Toolbar (Hidden in print) */}
      <nav className="print:hidden flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
            CHORDSHEET <span className="text-indigo-600">PRO</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Key:</label>
          <select 
            value={search.key || originalKey}
            onChange={(e) => setKey(e.target.value)}
            disabled={search.mode === 'lyrics'}
            className="flex h-9 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {KEYS.map(k => (
              <option key={k} value={k}>{k === originalKey ? `${k} (Default)` : k}</option>
            ))}
          </select>

          {/* View Toggler */}
          <div className="flex bg-slate-100 p-1 rounded-lg ml-2">
            <button 
              onClick={() => navigate({ search: { ...search, mode: 'standard' } })}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${search.mode === 'standard' || !search.mode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Chords
            </button>
            <button 
              onClick={() => navigate({ search: { ...search, mode: 'nashville' } })}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${search.mode === 'nashville' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Numerals
            </button>
            <button 
              onClick={() => navigate({ search: { ...search, mode: 'lyrics' } })}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${search.mode === 'lyrics' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Lyrics
            </button>
          </div>
          
          <button 
            onClick={() => window.print()}
            className="rounded-md bg-slate-900 px-4 py-1.5 text-xs font-semibold tracking-wide text-white shadow-sm hover:bg-slate-800"
          >
            PRINT
          </button>
        </div>
      </nav>

      {/* Split View */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Editor (Hidden in print) */}
        <section className="print:hidden hidden w-1/3 flex-col border-r border-slate-200 relative md:flex z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50/50 p-6">
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Song Title</label>
              <input 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                placeholder="Song Title" 
                className={shadcnInput}
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Artist</label>
                <input 
                  value={artist} 
                  onChange={e => setArtist(e.target.value)} 
                  placeholder="Artist" 
                  className={shadcnInput}
                />
              </div>
              <div className="w-24">
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Original Key</label>
                <select 
                  value={originalKey} 
                  onChange={e => setOriginalKey(e.target.value)} 
                  className={shadcnInput}
                >
                  <option value="" disabled>Key</option>
                  {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div className="w-24">
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Tempo</label>
                <input 
                  value={tempo} 
                  onChange={e => setTempo(e.target.value)} 
                  placeholder="Tempo" 
                  className={shadcnInput}
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Scan</label>
              <input 
                value={scanOverride} 
                onChange={e => setScanOverride(e.target.value)} 
                placeholder="Ex: INTRO. V1. C." 
                className={shadcnInput}
              />
            </div>
          </div>
          <Editor 
            value={text} 
            onChange={setText} 
            onStandardizeRequested={handleStandardize}
          />
        </section>


        {/* Live Viewer (Expands to full in print) */}
        <section className="print:w-full print:block flex-1 overflow-y-auto">
          <Viewer 
            chordProText={text} 
            title={title}
            artist={artist}
            tempo={tempo}
            customScan={scanOverride}
            originalKey={originalKey} 
            targetKey={search.key || originalKey} 
            mode={search.mode || 'standard'} 
          />
        </section>
      </div>

    </main>
  )
}
