// Builds the prompt for one category, calls the model, verifies the answer.

import { CATEGORY_BY_ID, gradeFor, LIMITS } from '../../shared/config.js'
import { selectFiles } from '../../shared/select.js'
import { CRITERIA, buildSystemPrompt } from '../_prompts/index.js'
import { askModel, modelName } from './openai.js'
import { blobUrl, verifyEvidence, verifyFact } from './verify.js'
import { HttpError } from './github.js'

function renderFile(f) {
  const lines = f.content.split('\n')
  const changed = new Set()
  for (const [a, b] of f.changed || []) for (let n = a; n <= b; n++) changed.add(n)
  const tag = f.changed ? ' [CHANGED BY THIS PR]' : ''
  const head = `=== ${f.path} (${lines.length} lines)${tag}${f.truncated ? ' [TRUNCATED]' : ''} ===`
  const body = lines.map((l, i) => `${String(i + 1).padStart(4)}${changed.has(i + 1) ? '+' : ' '}| ${l}`).join('\n')
  return `${head}\n${body}`
}

function describeGit(git, pr) {
  const out = []
  if (pr) {
    out.push('PULL REQUEST BEING REVIEWED:')
    out.push(JSON.stringify({ number: pr.number, title: pr.title, state: pr.state, branch: pr.headRef, base: pr.baseRef, description: pr.body || '(empty)', commits: pr.commitMessages, changedFiles: pr.changedFiles, additions: pr.additions, deletions: pr.deletions, reviews: pr.reviews, comments: pr.comments }, null, 1))
  }
  if (git) {
    out.push('REPOSITORY HISTORY (team-level facts, no names):')
    out.push(JSON.stringify(git, null, 1))
  }
  return out.join('\n') || 'No Git data was available.'
}

export function buildUserMessage({ category, files, versions, facts, mode, pr, git, tree, skippedNote }) {
  const parts = []
  parts.push(`MODE: ${mode === 'pr' ? 'PULL REQUEST REVIEW. Judge ONLY the changes of this PR (lines marked +) and whether they fit the existing app shown as context.' : 'FULL REPOSITORY AUDIT of the default branch.'}`)
  parts.push(`VERSIONS (from Gemfile.lock): ${JSON.stringify(versions || {})}`)
  if (category.kind === 'git') {
    parts.push(`AUTOMATED FACTS:\n${describeGit(git, mode === 'pr' ? pr : null)}`)
    return parts.join('\n\n')
  }
  parts.push(`AUTOMATED FACTS (exact, from plain code checks):\n${facts || 'none'}`)
  if (mode === 'pr' && pr) parts.push(`PULL REQUEST: #${pr.number} "${pr.title}"\n${(pr.body || '').slice(0, 800)}`)
  if (tree?.length) parts.push(`PROJECT FILE LIST (app files, for context):\n${tree.slice(0, 250).join('\n')}`)
  if (skippedNote) parts.push(skippedNote)
  parts.push(`FILES:\n\n${files.map(renderFile).join('\n\n')}`)
  return parts.join('\n\n')
}

// A believable fake answer made from the first real file, so the whole pipeline
// (including verification) can be tried without an OpenAI key.
function mockAnswer(files, category) {
  const f = files.find((x) => x.content.trim()) || { path: '', content: '' }
  const lines = f.content.split('\n')
  const idx = Math.max(0, lines.findIndex((l) => l.trim().length > 12))
  const ev = (n) => ({ file: f.path, start_line: idx + 1, end_line: idx + 1, snippet: lines[idx] || '' })
  return {
    json: {
      applicable: category.id !== 'ai_assets',
      score: 70 + ((f.path.length * 7) % 25),
      verdict: `Mock mode: a friendly one-line verdict for ${category.name}.`,
      wins: [{ title: 'A tidy, readable start', detail: 'This is a mock win, quoted from a real line of your code.', evidence: ev() }],
      level_ups: [
        { title: 'A mock level-up with real evidence', why: 'Mock mode never calls OpenAI, but the evidence below is real and verified.', concept: 'Stimulus targets', confidence: 'high', impact: 4, mission: 'Next time, trust what you already know.', example: 'data-controller="hello"', evidence: ev() },
        { title: 'A made-up finding that should be removed', why: 'This evidence does not exist, so the verifier drops it.', concept: 'resources', confidence: 'medium', impact: 3, mission: 'Never shown.', example: '', evidence: { file: f.path, start_line: 1, end_line: 1, snippet: 'this line does not exist anywhere' } },
      ],
    },
    usage: null,
  }
}

export async function analyzeCategory(input) {
  const category = CATEGORY_BY_ID[input.category]
  if (!category) throw new HttpError(400, `Unknown category "${input.category}".`)

  // The browser already chose the files, but we re-apply the size budget as a safety net
  const { selected, left } = selectFiles(category, (input.files || []).map((f) => ({ ...f, template: false })), {
    mode: input.mode,
    cap: LIMITS.perCategoryChars + 20000,
  })
  const files = category.kind === 'git' ? [] : selected
  const skippedNote = [...(input.skippedPaths || []), ...left].length
    ? `NOTE: ${[...(input.skippedPaths || []), ...left].length} file(s) were left out to stay within the size budget (e.g. ${[...(input.skippedPaths || []), ...left].slice(0, 5).join(', ')}). Do not comment on files you cannot see.`
    : ''

  const user = buildUserMessage({ category, files, versions: input.versions, facts: input.facts, mode: input.mode, pr: input.pr, git: input.git, tree: input.tree, skippedNote })
  const system = buildSystemPrompt(category.name, CRITERIA[category.id])

  const { json: raw, usage } = process.env.MOCK_LLM ? mockAnswer(files, category) : await askModel(system, user)

  // ── verification ──
  const byPath = Object.fromEntries(files.map((f) => [f.path, f]))
  const factsText = category.kind === 'git' ? describeGit(input.git, input.mode === 'pr' ? input.pr : null) : ''
  const verify = (ev, { required }) => {
    const hasEvidence = ev && (ev.file || ev.snippet)
    if (!hasEvidence) return required ? { ok: false } : { ok: true, evidence: null }
    return category.kind === 'git' ? verifyFact(ev, factsText) : verifyEvidence(ev, byPath)
  }

  let removed = 0
  const withLinks = (r) => {
    const e = r.evidence
    return e ? { ...e, url: blobUrl(input.repo, e.file, e.startLine, e.endLine) } : null
  }

  const wins = []
  for (const w of (raw.wins || []).slice(0, 3)) {
    const r = verify(w.evidence, { required: false })
    if (!r.ok) { removed += 1; continue }
    wins.push({ title: w.title, detail: w.detail, evidence: withLinks(r) })
  }
  const levelUps = []
  for (const l of (raw.level_ups || []).slice(0, 4)) {
    const r = verify(l.evidence, { required: true })
    if (!r.ok) { removed += 1; continue }
    levelUps.push({
      title: l.title, why: l.why, concept: l.concept, mission: l.mission, example: l.example || '',
      confidence: ['high', 'medium', 'low'].includes(l.confidence) ? l.confidence : 'medium',
      impact: Math.min(5, Math.max(1, Math.round(l.impact) || 2)),
      relocated: !!r.relocated,
      evidence: withLinks(r),
    })
  }

  const applicable = category.canBeNA ? raw.applicable !== false : true
  const score = applicable ? Math.min(100, Math.max(0, Math.round(raw.score))) : null
  return {
    category: category.id,
    applicable,
    score,
    grade: applicable ? gradeFor(score) : 'N/A',
    verdict: raw.verdict,
    wins,
    levelUps: levelUps.slice(0, 3),
    removed,
    filesSeen: files.length,
    model: process.env.MOCK_LLM ? 'mock' : modelName(),
    usage,
  }
}
