// Picks which files go to the AI for one category, within a size budget.
// Shared by the browser (to build the request) and the server (safety net).

import { LIMITS, PR_CONTEXT_PATTERNS } from './config.js'

export function selectFiles(category, files, { mode = 'repo', cap = LIMITS.perCategoryChars } = {}) {
  const ranked = []
  for (const f of files) {
    if (f.template || !f.content) continue
    let rank = category.files.findIndex((r) => r.test(f.path))
    if (rank === -1) continue
    if (mode === 'pr') {
      // changed files first; unchanged files only when they give useful context
      if (f.changed) rank = -1
      else if (!PR_CONTEXT_PATTERNS.some((r) => r.test(f.path))) continue
      else rank += 100
    }
    ranked.push({ f, rank })
  }
  ranked.sort((a, b) => a.rank - b.rank || a.f.content.length - b.f.content.length)

  const selected = []
  const left = []
  let used = 0
  for (const { f } of ranked) {
    const room = cap - used
    if (f.content.length <= room) {
      selected.push(f)
      used += f.content.length
    } else if (room > 4000) {
      const cut = f.content.slice(0, room)
      selected.push({ ...f, content: cut.slice(0, cut.lastIndexOf('\n')), truncated: true })
      used = cap
    } else {
      left.push(f.path)
    }
  }
  return { selected, left, chars: used }
}
