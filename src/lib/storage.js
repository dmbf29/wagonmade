// History lives in localStorage (no database). Reports are small: only findings, never the code.

const KEY = 'wagonmade:reports:v1'

export function loadReports() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function persist(list) {
  let copy = [...list]
  for (;;) {
    try {
      localStorage.setItem(KEY, JSON.stringify(copy))
      return copy
    } catch {
      if (copy.length <= 1) return copy
      copy = copy.slice(0, -1) // storage full: forget the oldest report
    }
  }
}

export function saveReport(report) {
  const rest = loadReports().filter((r) => r.key !== report.key)
  return persist([report, ...rest])
}

export function deleteReport(key) {
  return persist(loadReports().filter((r) => r.key !== key))
}

export function lastReportForRepo(owner, name) {
  const id = `${owner}/${name}`.toLowerCase()
  return loadReports().find((r) => r.key.startsWith(id + '@') || r.key.startsWith(id + '#'))
}

export function exportJson(reports) {
  return JSON.stringify({ app: 'wagonmade', version: 1, exportedAt: new Date().toISOString(), reports }, null, 2)
}

export function parseImport(text) {
  let json
  try { json = JSON.parse(text) } catch { throw new Error("That file isn't valid JSON.") }
  const reports = Array.isArray(json?.reports) ? json.reports : json?.categories ? [json] : null
  if (!reports) throw new Error("That file doesn't look like a Wagonmade export.")
  const ok = reports.filter((r) => r && r.key && Array.isArray(r.categories) && r.repo)
  if (!ok.length) throw new Error('No reports found in that file.')
  return ok
}

export function importReports(reports) {
  const merged = new Map(loadReports().map((r) => [r.key, r]))
  for (const r of reports) merged.set(r.key, r)
  const list = [...merged.values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  return persist(list)
}

export function download(filename, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Teacher's category weights (Phase 2). Only used to compute "Overall"; saved reports are never changed.
const WEIGHTS_KEY = 'wagonmade:weights:v1'

export function loadWeights() {
  try {
    const w = JSON.parse(localStorage.getItem(WEIGHTS_KEY) || 'null')
    return w && typeof w === 'object' ? w : null
  } catch {
    return null
  }
}

export function saveWeights(weights) {
  try {
    if (weights) localStorage.setItem(WEIGHTS_KEY, JSON.stringify(weights))
    else localStorage.removeItem(WEIGHTS_KEY)
  } catch { /* private mode: the weights just last for this visit */ }
}
