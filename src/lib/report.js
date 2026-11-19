// Turns fetch data + category results into one saved "report" object.

import { CATEGORIES, CATEGORY_BY_ID, gradeFor } from '../../shared/config.js'
import { sameFinding } from './split.js'

export function reportKey(data) {
  const base = `${data.owner}/${data.repo}`.toLowerCase()
  return `${base}${data.mode === 'pr' ? `#${data.pr.number}` : ''}@${data.sha.slice(0, 7)}`
}

export const defaultWeights = () => Object.fromEntries(CATEGORIES.map((c) => [c.id, c.weight]))

// `weights` is an optional { categoryId: number } map (the teacher's own weights); missing ids use the default.
export function overallScore(categories, weights) {
  let total = 0
  let weightSum = 0
  for (const c of categories) {
    if (!c.applicable || c.error || c.score == null) continue
    const w = weights?.[c.id] ?? CATEGORY_BY_ID[c.id]?.weight ?? 1
    total += c.score * w
    weightSum += w
  }
  return weightSum ? Math.round(total / weightSum) : null
}

const CONF = { high: 3, medium: 1, low: -10 }

export function pickMissions(categories, count = 3, weights) {
  const all = []
  for (const c of categories) {
    if (!c.applicable || c.error) continue
    for (const l of c.levelUps) {
      if (l.confidence === 'low') continue
      all.push({ ...l, categoryId: c.id, categoryName: c.name, rank: l.impact * 10 + (weights?.[c.id] ?? CATEGORY_BY_ID[c.id]?.weight ?? 1) * 2 + CONF[l.confidence] })
    }
  }
  all.sort((a, b) => b.rank - a.rank)
  // the same problem is often found by several categories: keep only the best-ranked one
  const distinct = []
  for (const m of all) if (!distinct.some((d) => sameFinding(d, m))) distinct.push(m)
  const picked = []
  const seen = new Set()
  for (const m of distinct) if (picked.length < count && !seen.has(m.categoryId)) { picked.push(m); seen.add(m.categoryId) }
  for (const m of distinct) if (picked.length < count && !picked.includes(m)) picked.push(m)
  return picked
}

// One category result from /api/analyze (or an error) -> the shape stored in a report
export function toCategory(def, r = { error: 'No answer' }) {
  return {
    id: def.id, name: def.name, tagline: def.tagline,
    applicable: r.error ? true : r.applicable !== false,
    error: r.error || null, hint: r.hint || null,
    score: r.score ?? null, grade: r.error ? null : r.grade,
    verdict: r.verdict || '', wins: r.wins || [], levelUps: r.levelUps || [], removed: r.removed || 0,
  }
}

// Everything that is derived from the categories (so it can be redone after a single re-run)
function summarize(categories) {
  const score = overallScore(categories)
  const wagonmade = categories.find((c) => c.id === 'wagonmade')
  return {
    overall: score == null ? null : { score, grade: gradeFor(score) },
    wagonmade: wagonmade && wagonmade.score != null ? { score: wagonmade.score, grade: wagonmade.grade } : null,
    categories,
    missions: pickMissions(categories),
    removedTotal: categories.reduce((n, c) => n + (c.removed || 0), 0),
    complete: categories.every((c) => !c.error),
  }
}

// Swap one category in a saved report and recompute the totals
export function replaceCategory(report, result) {
  const def = CATEGORY_BY_ID[result.category]
  const categories = report.categories.map((c) => (c.id === def.id ? toCategory(def, result) : c))
  return { ...report, ...summarize(categories), createdAt: new Date().toISOString() }
}

// The report as the teacher's weights see it (display only: the saved report is never changed)
export function withWeights(report, weights) {
  if (!report || !weights) return report
  const same = CATEGORIES.every((c) => (weights[c.id] ?? c.weight) === c.weight)
  if (same && report.weighted !== true) return report
  const score = overallScore(report.categories, weights)
  return {
    ...report,
    overall: score == null ? null : { score, grade: gradeFor(score) },
    missions: pickMissions(report.categories, 3, weights),
    weighted: !same,
  }
}

export function buildReport({ data, team, checks, results, tookMs }) {
  const categories = CATEGORIES.map((def) => toCategory(def, results.find((x) => x.category === def.id)))
  const sum = summarize(categories)
  return {
    app: 'wagonmade', version: 1,
    key: reportKey(data),
    createdAt: new Date().toISOString(),
    team: (team || '').trim(),
    mode: data.mode,
    repo: { owner: data.owner, name: data.repo, url: data.htmlUrl, sha: data.sha, branch: data.branch },
    pr: data.pr ? { number: data.pr.number, title: data.pr.title, url: data.pr.url } : null,
    versions: checks.versions,
    quickChecks: (checks.checks || []).map((c) => ({ id: c.id, severity: c.severity, text: c.ticker(c.count), count: c.count })),
    ...sum,
    skipped: { tooLarge: (data.skipped?.tooLarge || []).length, templateStylesheets: data.stylesheetTemplate?.identical || 0 },
    tookSeconds: Math.round(tookMs / 1000),
  }
}

export const displayName = (r) => r.team || (r.pr ? `${r.repo.owner}/${r.repo.name}` : r.repo.name)

// ── "What changed" between two reports of the same project ──

const sameProject = (a, b) => a.repo.owner.toLowerCase() === b.repo.owner.toLowerCase()
  && a.repo.name.toLowerCase() === b.repo.name.toLowerCase()
  && (a.pr?.number ?? null) === (b.pr?.number ?? null)

export const isSameProject = sameProject

// The most recent older report of the same repo (and same PR, when it is a PR)
export function previousReport(report, all) {
  return all
    .filter((r) => r.key !== report.key && sameProject(r, report) && String(r.createdAt) < String(report.createdAt))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0] || null
}

// Line numbers move and titles get reworded between runs: the file + concept is the steadiest identity.
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const levelUpId = (catId, l) => `${catId}|${l.evidence?.file || ''}|${norm(l.concept) || norm(l.title)}`

export function diffReports(prev, cur) {
  const confident = (c) => (c.applicable && !c.error ? c.levelUps.filter((l) => l.confidence !== 'low') : [])
  const prevById = Object.fromEntries(prev.categories.map((c) => [c.id, c]))
  const categories = []
  const resolved = []
  const added = []
  const newWins = []
  for (const c of cur.categories) {
    const p = prevById[c.id]
    if (!p) continue
    if (c.score != null && p.score != null) categories.push({ id: c.id, name: c.name, from: p.score, to: c.score, delta: c.score - p.score, gradeFrom: p.grade, gradeTo: c.grade })
    if (p.error || c.error || !p.applicable || !c.applicable) continue
    const before = new Set(confident(p).map((l) => levelUpId(c.id, l)))
    const after = new Set(confident(c).map((l) => levelUpId(c.id, l)))
    for (const l of confident(p)) if (!after.has(levelUpId(c.id, l))) resolved.push({ ...l, categoryName: c.name })
    for (const l of confident(c)) if (!before.has(levelUpId(c.id, l))) added.push({ ...l, categoryName: c.name })
    const oldWins = new Set(p.wins.map((w) => norm(w.title)))
    for (const w of c.wins) if (!oldWins.has(norm(w.title))) newWins.push({ ...w, categoryName: c.name })
  }
  const delta = cur.overall && prev.overall ? cur.overall.score - prev.overall.score : null
  const wagonmadeDelta = cur.wagonmade && prev.wagonmade ? cur.wagonmade.score - prev.wagonmade.score : null
  return { delta, wagonmadeDelta, categories, resolved, added, newWins, sameCode: prev.repo.sha === cur.repo.sha }
}
