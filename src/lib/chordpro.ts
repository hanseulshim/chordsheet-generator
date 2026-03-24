// Define block markers
export const SECTION_MARKERS = [
  'verse', 'chorus', 'bridge', 'intro', 'outro', 'pre-chorus', 'interlude', 'coda'
]

export interface RoadmapItem {
  id: string
  label: string
}

export function parseSectionsAndRoadmap(chordPro: string): { finalChordPro: string, roadmap: RoadmapItem[] } {
  const lines = chordPro.split('\n')
  const outLines: string[] = []
  const roadmap: RoadmapItem[] = []

  let inSection = false
  let firstChorusContent: string[] = []
  let capturingChorus = false
  
  // Heuristic: Check if a line is a section header like "VERSE 1:", "Chorus"
  const isSectionHeader = (line: string) => {
    const trimmed = line.trim().toLowerCase().replace(/:/g, '')
    return SECTION_MARKERS.some(m => trimmed.startsWith(m))
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Catch repeats
    if (line.trim().toLowerCase() === '{chorus}' || line.trim().toLowerCase() === '{ch}') {
      if (firstChorusContent.length > 0) {
        // inject the first chorus explicitly, wrapped in {soc}/{eoc} or {sov}/{eov}
        outLines.push('{soc}')
        outLines.push(...firstChorusContent)
        outLines.push('{eoc}')
      } else {
        outLines.push(line)
      }
      continue
    }

    if (isSectionHeader(line)) {
      if (inSection) {
        // Close previous section
        outLines.push(capturingChorus ? '{eoc}' : '{eov}')
        capturingChorus = false
      }

      inSection = true
      const headerTitle = line.trim().replace(/:/g, '')
      
      const isChorus = headerTitle.toLowerCase().includes('chorus')
      if (isChorus) {
        outLines.push('{soc}')
        if (firstChorusContent.length === 0) {
          capturingChorus = true // First time we see chorus, let's capture it
        }
      } else {
        outLines.push('{sov}')
      }

      outLines.push(line)
      
      // Make roadmap ID safe
      const id = headerTitle.toLowerCase().replace(/\\s+/g, '-')
      // Produce short label: "VERSE 1" -> "V1", "CHORUS" -> "C"
      let label = headerTitle[0].toUpperCase()
      const parts = headerTitle.split(' ')
      if (parts.length > 1 && !isNaN(parseInt(parts[1]))) {
        label += parts[1]
      }
      roadmap.push({ id, label: headerTitle }) // or exact uppercase 

    } else {
      outLines.push(line)
      if (capturingChorus) {
        firstChorusContent.push(line)
      }
    }
  }

  if (inSection) {
    outLines.push(capturingChorus ? '{eoc}' : '{eov}')
  }

  return {
    finalChordPro: outLines.join('\n'),
    roadmap
  }
}
