// Downloads a repo (one tarball request), filters out template boilerplate,
// scans for committed secrets, and gathers Git-workflow facts.

import {
  INCLUDE_PATTERNS, SKIP_PATTERNS, TEMPLATE_PATTERNS, STYLESHEETS_TEMPLATE, LIMITS,
} from '../../shared/config.js'
import { githubHeaders, explainGithubError, gh, ghPaged, HttpError } from './github.js'
import { readTarball } from './tar.js'

const isIncluded = (path) => INCLUDE_PATTERNS.some((r) => r.test(path)) && !SKIP_PATTERNS.some((r) => r.test(path))
const isTemplatePath = (path) => TEMPLATE_PATTERNS.some((r) => r.test(path))

// Files we only READ to look for committed secrets (never sent to the browser)
const SCAN_ONLY = /(^|\/)(\.env[\w.-]*|[\w.-]+\.(rb|erb|js|yml|yaml|json|md|txt|ru|rake|sh|toml|scss|css))$/i
const NO_SCAN_DIRS = /^(vendor|node_modules|tmp|log|public|storage|\.git)\//

const SECRET_PATTERNS = [
  ['OpenAI-style key', /sk-(?:proj-)?[A-Za-z0-9_-]{24,}/],
  ['Google API key', /AIza[0-9A-Za-z_-]{35}/],
  ['AWS access key', /AKIA[0-9A-Z]{16}/],
  ['Cloudinary URL with secret', /cloudinary:\/\/\d{6,}:[\w-]{10,}@/],
  ['GitHub token', /\b(ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/],
  ['Private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['Rails secret_key_base', /secret_key_base\s*[:=]\s*["']?[0-9a-f]{64,}/i],
]
const PLACEHOLDER = /xxx|your[_-]?(api|key)|<.*>|example|changeme|\*{4,}/i

function scanForSecrets(path, text, hits) {
  if (/\.(lock|enc)$/.test(path) || path === 'db/schema.rb') return
  const lines = text.split('\n')
  for (let i = 0; i < lines.length && hits.length < 25; i++) {
    for (const [kind, re] of SECRET_PATTERNS) {
      const m = lines[i].match(re)
      if (m && !PLACEHOLDER.test(m[0]) && !/ENV\[|ENV\.fetch|<%=/.test(lines[i])) {
        hits.push({ path, line: i + 1, kind })
        break
      }
    }
  }
}

const normalise = (s) => s.replace(/\r\n/g, '\n').split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').trim()

// ── official stylesheets (cached while the function stays warm) ─────────────
let stylesheetCache = { at: 0, files: null }

export async function loadTemplateStylesheets() {
  if (stylesheetCache.files && Date.now() - stylesheetCache.at < 60 * 60 * 1000) return stylesheetCache.files
  const { owner, repo, ref } = STYLESHEETS_TEMPLATE
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/tarball/${ref}`, { headers: githubHeaders(), redirect: 'follow' })
  if (!res.ok) return null
  const files = {}
  await readTarball(res, (p) => (/\.scss$/.test(p) ? 'keep' : 'skip'), (p, data) => { files[p] = normalise(data.toString('utf8')) })
  stylesheetCache = { at: Date.now(), files }
  return files
}

// ── main download ───────────────────────────────────────────────────────────
// Order in which files are added to the (size-capped) response
const ORDER = [
  /^Gemfile\.lock$/, /^Gemfile$/, /^config\/routes\.rb$/, /^db\/schema\.rb$/, /^config\/importmap\.rb$/,
  /^app\/controllers\//, /^app\/models\//, /^app\/views\//, /^app\/javascript\//,
  /^app\/assets\/stylesheets\//, /^config\//, /^app\//, /^\.gitignore$/, /^README\.md$/i,
]
const orderOf = (p) => { const i = ORDER.findIndex((r) => r.test(p)); return i === -1 ? ORDER.length : i }

export async function downloadRepo({ owner, repo, sha, tarballRepo }) {
  const [tOwner, tRepo] = (tarballRepo || `${owner}/${repo}`).split('/')
  const res = await fetch(`https://api.github.com/repos/${tOwner}/${tRepo}/tarball/${sha}`, { headers: githubHeaders(), redirect: 'follow' })
  if (!res.ok) throw explainGithubError(res, 'the code of this repository')

  const kept = new Map()
  const secretHits = []
  const [templateCss] = await Promise.all([loadTemplateStylesheets().catch(() => null)])
  const { allPaths } = await readTarball(
    res,
    (path, size) => {
      if (size > LIMITS.maxFileBytes) return 'skip'
      if (isIncluded(path)) return 'keep'
      if (!NO_SCAN_DIRS.test(path) && SCAN_ONLY.test(path) && size < 150000) return 'keep'
      return 'skip'
    },
    (path, data) => {
      if (data.subarray(0, 2000).includes(0)) return // binary
      const text = data.toString('utf8')
      scanForSecrets(path, text, secretHits)
      if (isIncluded(path)) kept.set(path, text)
    },
    { maxBytes: LIMITS.maxTarballBytes },
  )

  // Template boilerplate: Devise views, navbar… and stylesheets identical to lewagon/rails-stylesheets
  let templateIdentical = 0
  const files = []
  for (const [path, content] of kept) {
    let template = isTemplatePath(path)
    const m = path.startsWith(STYLESHEETS_TEMPLATE.mountAt) && path.slice(STYLESHEETS_TEMPLATE.mountAt.length)
    if (m && templateCss && templateCss[m] !== undefined && templateCss[m] === normalise(content)) {
      template = true
      templateIdentical += 1
    }
    // stylesheets are small and checks need _index.scss imports, so keep their text
    const keepText = !template || path.startsWith(STYLESHEETS_TEMPLATE.mountAt)
    files.push({ path, content: keepText ? content : '', template })
  }
  files.sort((a, b) => orderOf(a.path) - orderOf(b.path) || a.path.localeCompare(b.path))

  return {
    files,
    allPaths: allPaths.map((p) => p.path).filter((p) => !/^(vendor|node_modules|tmp|log)\//.test(p)).slice(0, 4000),
    nodeModulesCommitted: allPaths.some((p) => /^node_modules\//.test(p.path)),
    hygiene: { secretHits },
    stylesheetTemplate: { available: !!templateCss, identical: templateIdentical },
  }
}

// Caps the response size; returns which files had to be left out
export function capFiles(files, maxChars = LIMITS.fetchResponseChars) {
  let used = 0
  const out = []
  const dropped = []
  for (const f of files) {
    if (used + f.content.length > maxChars) { dropped.push({ path: f.path, chars: f.content.length }); continue }
    used += f.content.length
    out.push(f)
  }
  return { files: out, dropped }
}

// ── Git workflow facts ──────────────────────────────────────────────────────
const GENERIC_MSG = /^(wip|update|updates|fix|fixes|test|tests|asdf+|\.+|changes?|commit|stuff|final|done|ok|minor|misc|save|init(ial)?( commit)?)\.?$/i
const median = (arr) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }

export async function gatherGitFacts({ owner, repo, defaultBranch }) {
  const [pulls, contributors, commits] = await Promise.all([
    ghPaged(`/repos/${owner}/${repo}/pulls?state=all`, { maxPages: 2, what: 'the pull requests' }).catch(() => []),
    gh(`/repos/${owner}/${repo}/contributors?per_page=30`, { optional: true }).then((r) => r || []),
    gh(`/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(defaultBranch)}&per_page=${LIMITS.recentCommits}`, { optional: true }).then((r) => r || []),
  ])

  const recent = pulls.slice(0, LIMITS.detailedPullRequests)
  const details = await Promise.all(
    recent.map(async (p) => {
      const [d, reviews] = await Promise.all([
        gh(`/repos/${owner}/${repo}/pulls/${p.number}`, { optional: true }),
        gh(`/repos/${owner}/${repo}/pulls/${p.number}/reviews`, { optional: true }),
      ])
      return { p, d, reviews: reviews || [] }
    }),
  )

  const humans = contributors.filter((c) => c.type !== 'Bot' && !/\[bot\]$/.test(c.login))
  const totalContrib = humans.reduce((n, c) => n + c.contributions, 0) || 1
  const shares = humans.map((c) => Math.round((c.contributions / totalContrib) * 100)).sort((a, b) => b - a)

  const sizes = details.filter((x) => x.d).map((x) => (x.d.additions || 0) + (x.d.deletions || 0))
  const merged = pulls.filter((p) => p.merged_at).length
  const prNumbers = new Set(pulls.map((p) => p.number))
  const subjects = commits.map((c) => (c.commit?.message || '').split('\n')[0])
  const mergeCommits = commits.filter((c) => (c.parents || []).length > 1).length
  const direct = commits.filter((c) => (c.parents || []).length < 2 && !/\(#\d+\)\s*$/.test(c.commit?.message.split('\n')[0] || '') && !/^Merge /.test(c.commit?.message || '')).length

  const branchNames = [...new Set(pulls.map((p) => p.head?.ref).filter(Boolean))]
  const dates = commits.map((c) => new Date(c.commit?.author?.date || 0).getTime()).filter(Boolean)

  return {
    pullRequests: {
      total: pulls.length,
      merged,
      open: pulls.filter((p) => p.state === 'open').length,
      withDescription: details.filter((x) => (x.d?.body || '').trim().length > 20).length,
      detailedCount: details.length,
      withReviewOrComment: details.filter((x) => x.reviews.length || (x.d?.review_comments || 0) || (x.d?.comments || 0)).length,
      medianChangedLines: median(sizes),
      largestChangedLines: sizes.length ? Math.max(...sizes) : 0,
      branchNames: branchNames.slice(0, 15),
    },
    commits: {
      sampled: commits.length,
      onDefaultBranchPush: direct,
      mergeCommits,
      note: 'Direct pushes are approximate (squash/rebase merges can look like direct commits).',
      messageSamples: subjects.slice(0, 14),
      tooShort: subjects.filter((s) => s.length < 8).length,
      generic: subjects.filter((s) => GENERIC_MSG.test(s.trim())).length,
      averageLength: subjects.length ? Math.round(subjects.reduce((n, s) => n + s.length, 0) / subjects.length) : 0,
    },
    team: {
      contributors: humans.length,
      // only percentages, sorted, no names: this is a team-level picture
      commitSharePercents: shares,
    },
    activeDays: dates.length ? Math.max(1, Math.round((Math.max(...dates) - Math.min(...dates)) / 86400000)) : 0,
    hasPullRequests: prNumbers.size > 0,
  }
}

export async function gatherPrFacts({ owner, repo, number }) {
  const [pr, files, commits, reviews] = await Promise.all([
    gh(`/repos/${owner}/${repo}/pulls/${number}`, { what: `pull request #${number}` }),
    ghPaged(`/repos/${owner}/${repo}/pulls/${number}/files`, { maxPages: 3, what: 'the pull request files' }),
    gh(`/repos/${owner}/${repo}/pulls/${number}/commits?per_page=100`, { optional: true }).then((r) => r || []),
    gh(`/repos/${owner}/${repo}/pulls/${number}/reviews`, { optional: true }).then((r) => r || []),
  ])
  return { pr, files, commits, reviews }
}

// Reads a unified-diff patch and returns the new-file line ranges that were added/changed
export function changedRangesFromPatch(patch) {
  if (!patch) return []
  const ranges = []
  let line = 0
  let start = null
  const close = () => { if (start !== null) { ranges.push([start, line - 1]); start = null } }
  for (const row of patch.split('\n')) {
    const h = row.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
    if (h) { close(); line = Number(h[1]); continue }
    if (row.startsWith('+')) { if (start === null) start = line; line += 1 }
    else if (row.startsWith('-')) { close() }
    else if (row.startsWith('\\')) { /* "no newline" marker */ }
    else { close(); line += 1 }
  }
  close()
  return ranges.filter(([a, b]) => b >= a)
}

export { HttpError }
