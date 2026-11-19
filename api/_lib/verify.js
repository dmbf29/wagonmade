// Anti-hallucination: every piece of evidence must really exist in the fetched files.
// The AI says "file X, lines 10-12, snippet S". We check it, fix small line-number
// slips, replace the snippet by the REAL lines, and drop anything we cannot find.

const norm = (s) => s.replace(/\s+/g, ' ').trim()
const stripGutter = (line) => line.replace(/^\s*\d+\+?\|\s?/, '')

export function normalisePath(p) {
  return String(p || '').trim().replace(/^\.?\//, '').replace(/^a\/|^b\//, (m) => m)
}

/**
 * @returns {{ ok: boolean, evidence?: object, relocated?: boolean }}
 */
export function verifyEvidence(ev, filesByPath, { tolerance = 3 } = {}) {
  if (!ev || !ev.file) return { ok: false }
  const file = filesByPath[normalisePath(ev.file)]
  if (!file) return { ok: false }

  const snippetLines = String(ev.snippet || '')
    .split('\n')
    .map(stripGutter)
    .map(norm)
    .filter(Boolean)
  if (!snippetLines.length) return { ok: false }

  const fileLines = file.content.split('\n')
  const fileNorm = fileLines.map(norm)
  const claimedStart = Number(ev.start_line) || 1

  // all positions where the snippet starts and then continues over following non-blank lines
  const candidates = []
  for (let i = 0; i < fileNorm.length; i++) {
    if (!fileNorm[i] || !fileNorm[i].includes(snippetLines[0])) continue
    let j = i
    let good = true
    for (let k = 1; k < snippetLines.length; k++) {
      j += 1
      while (j < fileNorm.length && !fileNorm[j]) j += 1
      if (j >= fileNorm.length || !fileNorm[j].includes(snippetLines[k])) { good = false; break }
    }
    if (good) candidates.push({ start: i + 1, end: j + 1 })
  }
  if (!candidates.length) return { ok: false }

  candidates.sort((a, b) => Math.abs(a.start - claimedStart) - Math.abs(b.start - claimedStart))
  const best = candidates[0]
  const relocated = Math.abs(best.start - claimedStart) > tolerance
  const end = Math.min(best.end, best.start + 11)
  return {
    ok: true,
    relocated,
    evidence: {
      file: file.path,
      startLine: best.start,
      endLine: end,
      snippet: fileLines.slice(best.start - 1, end).join('\n').replace(/\s+$/, ''),
    },
  }
}

// For the Git category: the "evidence" is a fact, so it must appear in the facts text.
// The model often rewords a fact ("12 merged PRs") instead of copying it, so an exact match would drop
// every Git finding. Accept it when every number in it exists in the facts and most of its words do too.
export function verifyFact(ev, factsText) {
  const snippet = norm(String(ev?.snippet || ''))
  if (!snippet) return { ok: false }
  const facts = norm(factsText).toLowerCase()
  const keep = { ok: true, evidence: { file: '', startLine: 0, endLine: 0, snippet: String(ev.snippet).trim() } }
  if (facts.includes(snippet.toLowerCase())) return keep
  const numbers = snippet.match(/\d+/g) || []
  const words = (snippet.toLowerCase().match(/[a-z_\-/]{4,}/g) || [])
  if (!words.length) return { ok: false }
  const found = words.filter((w) => facts.includes(w)).length / words.length
  return numbers.every((n) => facts.includes(n)) && found >= 0.6 ? keep : { ok: false }
}

export function blobUrl({ owner, repo, sha }, path, start, end) {
  if (!path) return ''
  const base = `https://github.com/${owner}/${repo}/blob/${sha}/${path.split('/').map(encodeURIComponent).join('/')}`
  if (!start) return base
  return end && end > start ? `${base}#L${start}-L${end}` : `${base}#L${start}`
}
