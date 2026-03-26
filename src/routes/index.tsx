import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { useState, useEffect } from 'react'
import { Editor } from '../components/Editor'
import { Viewer } from '../components/Viewer'
import { extractMetadata, parseChordOverText, compactChordPro } from '../lib/parser'
import { getLibrary, saveSong, deleteSong, type SavedSong } from '../lib/storage'
import { Music, FolderOpen, Save, Trash2, Plus, X } from 'lucide-react'

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
  
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [text, setText] = useState(DEFAULT_CHORDPRO)
  const [title, setTitle] = useState('Amazing Grace')
  const [artist, setArtist] = useState('John Newton')
  const [originalKey, setOriginalKey] = useState('G')
  const [tempo, setTempo] = useState('')
  const [scanOverride, setScanOverride] = useState('')
  const [fontSize, setFontSize] = useState(12)

  const [library, setLibrary] = useState<SavedSong[]>([])
  const [isLibraryOpen, setIsLibraryOpen] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [isCompact, setIsCompact] = useState(false)

  useEffect(() => {
    setLibrary(getLibrary())
  }, [])

  const handleSave = () => {
    const id = saveSong({
      title,
      artist,
      text,
      originalKey,
      tempo,
      scan: scanOverride,
    }, currentId || undefined)
    
    setCurrentId(id)
    setLibrary(getLibrary())
    
    // Show confirmation
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2000)
  }

  const handleNew = () => {
    setCurrentId(null)
    setTitle('Untitled Song')
    setArtist('')
    setOriginalKey('G')
    setTempo('')
    setText('')
    setScanOverride('')
  }

  const handleLoad = (song: SavedSong) => {
    setCurrentId(song.id)
    setTitle(song.title)
    setArtist(song.artist)
    setOriginalKey(song.originalKey)
    setTempo(song.tempo)
    setText(song.text)
    setScanOverride(song.scan || '')
    setIsLibraryOpen(false)
  }

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (confirm('Delete this song?')) {
      deleteSong(id)
      setLibrary(getLibrary())
      if (currentId === id) handleNew()
    }
  }

  const handleRoadmapChange = (scan: string) => {
    // Only auto-populate if the user hasn't typed something custom
    setScanOverride(prev => prev ? prev : scan)
  }

  const setKey = (newKey: string) => {
    navigate({ search: { ...search, key: newKey } })
  }

  const handleStandardize = (input: string) => {
    const meta = extractMetadata(input)
    if (meta.title) setTitle(meta.title)
    if (meta.artist) setArtist(meta.artist)
    if (meta.key) setOriginalKey(meta.key)
    if (meta.tempo) setTempo(meta.tempo)
    
    setScanOverride(meta.scan || '')
    const parsed = parseChordOverText(meta.remainingText)
    setText(parsed)
  }

  return (
    <main className="flex h-screen w-full flex-col overflow-hidden bg-slate-50 text-slate-800 print:h-auto print:overflow-visible print:block">
      
      {/* Library Sidebar Overlay */}
      {isLibraryOpen && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-sm print:hidden"
          onClick={() => setIsLibraryOpen(false)}
        >
          <div 
            className="absolute right-0 top-0 h-full w-80 bg-white shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Music className="w-5 h-5 text-indigo-600" /> My Library
              </h2>
              <button onClick={() => setIsLibraryOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <button 
                onClick={handleNew}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-dashed border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-all font-semibold text-sm mb-4"
              >
                <Plus className="w-4 h-4" /> New Song
              </button>
              
              {library.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  No saved songs yet
                </div>
              ) : library.map(song => (
                <div 
                  key={song.id}
                  onClick={() => handleLoad(song)}
                  className={`group relative flex flex-col p-4 rounded-xl border transition-all cursor-pointer ${currentId === song.id ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-sm'}`}
                >
                  <div className="font-bold text-slate-900 truncate pr-6">{song.title}</div>
                  <div className="text-xs text-slate-500 mt-1">{song.artist || 'Unknown Artist'}</div>
                  <button 
                    onClick={(e) => handleDelete(e, song.id)}
                    className="absolute top-4 right-4 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation / Toolbar (Hidden in print) */}
      <nav className="print:hidden flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
            CHORDSHEET
          </h1>
          
          <div className="h-6 w-px bg-slate-200 mx-2" />
          
          <button 
            onClick={handleSave}
            disabled={isSaved}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${isSaved ? 'text-emerald-600 bg-emerald-50' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            {isSaved ? (
              <>
                <Music className="w-4 h-4" /> SAVED!
              </>
            ) : (
              <>
                <Save className="w-4 h-4 text-indigo-500" /> SAVE
              </>
            )}
          </button>
          
          <button 
            onClick={() => setIsLibraryOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-md transition-colors"
          >
            <FolderOpen className="w-4 h-4 text-amber-500" /> LIBRARY
          </button>
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

          {/* Compact Toggle Button */}
          <button
            onClick={() => setIsCompact(c => !c)}
            className={`ml-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md border transition-all ${
              isCompact
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-400'
            }`}
            title="Toggle compact view (removes duplicate sections)"
          >
            Compact
          </button>

          {/* Font Resizer */}
          <div className="flex bg-slate-100 p-1 rounded-lg ml-2 items-center gap-1">
            <button 
              onClick={() => setFontSize(f => Math.max(8, f - 1))}
              className="px-2 py-1 text-[11px] font-extrabold text-slate-500 hover:text-slate-800 transition-colors"
              title="Decrease Font Size"
            >
              A-
            </button>
            <span className="text-[10px] font-bold text-slate-400 w-4 text-center select-none">{fontSize}</span>
            <button 
              onClick={() => setFontSize(f => Math.min(24, f + 1))}
              className="px-2 py-1 text-[11px] font-extrabold text-slate-500 hover:text-slate-800 transition-colors"
              title="Increase Font Size"
            >
              A+
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
      <div className="flex flex-1 overflow-hidden print:overflow-visible print:block relative">
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
                onChange={(e) => setScanOverride(e.target.value)}
                className={shadcnInput}
                placeholder="e.g. V1. C. V2. C. B. C."
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
        <section className="print:w-full print:block print:overflow-visible flex-1 overflow-y-auto">
          <Viewer 
            chordProText={isCompact ? compactChordPro(text) : text} 
            title={title}
            artist={artist}
            tempo={tempo}
            customScan={scanOverride}
            originalKey={originalKey} 
            targetKey={search.key || originalKey} 
            mode={search.mode || 'standard'} 
            fontSize={fontSize}
            onRoadmapChange={handleRoadmapChange}
          />
        </section>
      </div>

    </main>
  )
}
