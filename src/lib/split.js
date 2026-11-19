// Big categories are read in parts (parallel AI calls), then scored by one small call.
// These helpers cut the files into balanced parts and merge the verified findings back together.

export const SPLIT = { aboveChars: 45000, partChars: 30000, maxParts: 3 }

export function partsFor(files) {
  const total = files.reduce((n, f) => n + f.content.length, 0)
  return total > SPLIT.aboveChars ? Math.min(SPLIT.maxParts, Math.ceil(total / SPLIT.partChars)) : 1
}

// Biggest files first, each into the lightest part: parts end up about the same size
export function splitFiles(files, n) {
  const parts = Array.from({ length: n }, () => ({ files: [], chars: 0 }))
  for (const f of [...files].sort((a, b) => b.content.length - a.content.length)) {
    const lightest = parts.reduce((m, p) => (p.chars < m.chars ? p : m))
    lightest.files.push(f)
    lightest.chars += f.content.length
  }
  return parts.map((p) => p.files)
}

const STOP = new Set('this that with from your their they have will into when then than the and for are was not you out use used using should could make makes more also each only most just like very about into over'.split(' '))
const words = (s) => new Set((String(s || '').toLowerCase().match(/[a-z_][a-z_0-9]{3,}/g) || []).filter((w) => !STOP.has(w)))

// How alike two pieces of text are (0 to 1): shared words / all words
export function similarity(a, b) {
  const x = words(a); const y = words(b)
  if (!x.size || !y.size) return 0
  let both = 0
  for (const w of x) if (y.has(w)) both += 1
  return both / (x.size + y.size - both)
}

// Two findings about the same spot? Same file with lines that touch, or very alike text.
// Used so the same problem is not shown twice (as two wins, two level-ups, or two missions).
export function sameFinding(a, b, { text = (f) => `${f.title} ${f.mission || f.detail || ''}`, threshold = 0.3 } = {}) {
  const ea = a.evidence; const eb = b.evidence
  if (ea?.file && ea.file === eb?.file) {
    const near = ea.startLine && eb.startLine ? ea.startLine <= (eb.endLine || eb.startLine) + 5 && eb.startLine <= (ea.endLine || ea.startLine) + 5 : false
    if (near) return true
  }
  return similarity(text(a), text(b)) >= threshold
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const CONF = { high: 3, medium: 1, low: -10 }
const rank = (l) => l.impact * 10 + CONF[l.confidence]

// parts: results of stage "findings". Keeps the best 3 wins and 3 level-ups, without doubles.
export function mergeFindings(parts) {
  const levelUps = []
  for (const l of parts.flatMap((p) => p.levelUps).sort((a, b) => rank(b) - rank(a))) {
    const id = `${l.evidence?.file}|${norm(l.concept) || norm(l.title)}`
    if (levelUps.some((k) => `${k.evidence?.file}|${norm(k.concept) || norm(k.title)}` === id || sameFinding(k, l))) continue
    levelUps.push(l)
  }
  // wins: take turns between parts so one big part doesn't crowd out the others
  const wins = []
  const queues = parts.map((p) => [...p.wins])
  while (wins.length < 3 && queues.some((q) => q.length)) {
    for (const q of queues) {
      const w = q.shift()
      if (w && wins.length < 3 && !wins.some((k) => norm(k.title) === norm(w.title) || sameFinding(k, w, { threshold: 0.35 }))) wins.push(w)
    }
  }
  return {
    wins,
    levelUps: levelUps.slice(0, 3),
    removed: parts.reduce((n, p) => n + (p.removed || 0), 0),
    filesSeen: parts.reduce((n, p) => n + (p.filesSeen || 0), 0),
  }
}
