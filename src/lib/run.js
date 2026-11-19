// The browser orchestrates a run so no single serverless call has to do everything:
//   1) one call fetches the code            (/api/fetch-repo)
//   2) deterministic checks run instantly   (shared/checks.js, plain JS)
//   3) one AI call per category, in parallel (/api/analyze), each reported as it finishes

import { CATEGORIES, gradeFor } from '../../shared/config.js'
import { runChecks, limitChecksToPR, factsForCategory } from '../../shared/checks.js'
import { selectFiles } from '../../shared/select.js'
import { buildReport } from './report.js'

export async function postJson(url, body) {
  let res
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } catch {
    throw new Error('Could not reach the server. Is it running, and are you online?')
  }
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = null }
  if (!res.ok) {
    const err = new Error(data?.error || (res.status === 504 || res.status === 408 ? 'The server took too long to answer.' : `The server answered ${res.status}.`))
    err.hint = data?.hint
    throw err
  }
  if (!data) throw new Error('The server sent something we could not read.')
  return data
}

function makeContext(data, checks) {
  return {
    data, checks,
    tree: data.files.filter((f) => !f.template).map((f) => f.path),
    repoRef: { owner: data.owner, repo: data.repo, sha: data.sha },
    skippedPaths: data.skipped?.tooLarge?.map((d) => d.path) || [],
  }
}

// One category: N/A short-circuit, file selection, the AI call. Never throws: errors become { error }.
async function analyzeOne(cat, { data, checks, tree, repoRef, skippedPaths }) {
  try {
    if (cat.canBeNA && !checks.features.ai && !checks.features.uploads) {
      return { category: cat.id, applicable: false, score: null, grade: 'N/A', verdict: "No AI chat or uploads in this app yet, so nothing to grade here. Ready for the final project!", wins: [], levelUps: [], removed: 0 }
    }
    if (cat.kind === 'git' && !data.git) throw new Error('GitHub did not share the repository history.')
    const { selected, left } = selectFiles(cat, data.files, { mode: data.mode })
    return await postJson('/api/analyze', {
      category: cat.id,
      files: selected.map((f) => ({ path: f.path, content: f.content, changed: f.changed, truncated: f.truncated })),
      skippedPaths: [...skippedPaths, ...left].slice(0, 20),
      versions: checks.versions,
      facts: factsForCategory(checks, cat),
      mode: data.mode, pr: data.pr, git: data.git, tree, repo: repoRef,
    })
  } catch (err) {
    return { category: cat.id, error: err.message, hint: err.hint }
  }
}

function runQuickChecks(data) {
  const result = runChecks(data.files, { paths: data.allPaths, hygiene: data.hygiene })
  return data.mode === 'pr' ? limitChecksToPR(result, data.files) : result
}

// Re-run ONE category of a saved report: fetch the same code again, redo only that category.
// Refuses when the code moved on (a PR got new commits): then the old and new scores would not be comparable.
export async function rerunCategory(report, categoryId) {
  const cat = CATEGORIES.find((c) => c.id === categoryId)
  const url = report.pr ? report.pr.url : `${report.repo.url}/tree/${report.repo.sha}`
  const data = await postJson('/api/fetch-repo', { url })
  if (data.sha !== report.repo.sha) {
    const err = new Error('The code has changed since this report.')
    err.hint = 'Run the full check again so every category looks at the same version.'
    throw err
  }
  const r = await analyzeOne(cat, makeContext(data, runQuickChecks(data)))
  if (r.error) { const err = new Error(r.error); err.hint = r.hint; throw err }
  return r
}

export async function runAnalysis({ url, team }, emit) {
  const started = Date.now()
  emit({ type: 'step', id: 'fetch', status: 'running', text: 'Fetching your code from GitHub…' })
  const data = await postJson('/api/fetch-repo', { url })
  const analysable = data.files.filter((f) => !f.template)
  emit({
    type: 'step', id: 'fetch', status: 'done',
    text: `Fetched ${analysable.length} files in ${((Date.now() - started) / 1000).toFixed(1)}s`
      + (data.stylesheetTemplate?.identical ? ` · skipped ${data.stylesheetTemplate.identical} untouched template stylesheets` : ''),
  })
  emit({ type: 'meta', data: { mode: data.mode, owner: data.owner, repo: data.repo, pr: data.pr, branch: data.branch } })

  // ── deterministic checks ──
  emit({ type: 'step', id: 'checks', status: 'running', text: 'Running the quick checks…' })
  const result = runQuickChecks(data)
  emit({ type: 'versions', versions: result.versions })
  emit({ type: 'facts', facts: result.checks.map((c) => ({ id: c.id, severity: c.severity, text: c.ticker(c.count), count: c.count })) })
  emit({ type: 'step', id: 'checks', status: 'done', text: `Quick checks done · ${result.checks.length} things noticed` })

  // ── one AI call per category, in parallel ──
  const ctx = makeContext(data, result)
  const results = await Promise.all(
    CATEGORIES.map(async (cat) => {
      emit({ type: 'step', id: cat.id, status: 'running', text: `${cat.name}…` })
      const r = await analyzeOne(cat, ctx)
      emit({ type: 'category', result: r })
      if (r.error) emit({ type: 'step', id: cat.id, status: 'failed', text: `${cat.name} · ${r.error}` })
      else emit({ type: 'step', id: cat.id, status: 'done', text: r.applicable === false ? `${cat.name} · not applicable` : `${cat.name} ✓` })
      return r
    }),
  )

  return buildReport({ data, team, checks: result, results, tookMs: Date.now() - started })
}

export { gradeFor }
