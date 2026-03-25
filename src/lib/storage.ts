export interface SavedSong {
  id: string;
  title: string;
  artist: string;
  text: string;
  originalKey: string;
  tempo: string;
  scan?: string;
  updatedAt: number;
}

const STORAGE_KEY = 'chordsheet_pro_library';

export const getLibrary = (): SavedSong[] => {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveSong = (song: Omit<SavedSong, 'id' | 'updatedAt'>, id?: string): string => {
  const library = getLibrary();
  const newId = id || crypto.randomUUID();
  const now = Date.now();
  
  const newEntry: SavedSong = { ...song, id: newId, updatedAt: now };
  
  let updatedLibrary: SavedSong[];
  if (id && library.some(s => s.id === id)) {
    updatedLibrary = library.map(s => s.id === id ? newEntry : s);
  } else {
    updatedLibrary = [newEntry, ...library];
  }
    
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLibrary));
  return newId;
};

export const deleteSong = (id: string) => {
  const library = getLibrary();
  const updated = library.filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
};
