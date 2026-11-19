// POST /api/fetch-repo   { url }
// Step 1 of a run: downloads the code (one tarball request) + Git workflow data.

import { gh, parseGithubUrl, sendError } from './_lib/github.js'
import { capFiles, changedRangesFromPatch, downloadRepo, gatherGitFacts, gatherPrFacts } from './_lib/repo.js'

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' })
  try {
    const target = parseGithubUrl(req.body?.url)
    const { owner, repo } = target

    const repoInfo = await gh(`/repos/${owner}/${repo}`, { what: `${owner}/${repo}` })
    const defaultBranch = repoInfo.default_branch

    if (target.mode === 'pr') return res.status(200).json(await fetchPullRequest(target, repoInfo))

    // ── repo mode ──
    const ref = target.ref || defaultBranch
    const sha = (await gh(`/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`, { what: `branch "${ref}"`, accept: 'application/vnd.github.sha' })).trim()
    const [code, git] = await Promise.all([
      downloadRepo({ owner, repo, sha }),
      gatherGitFacts({ owner, repo, defaultBranch }).catch(() => null),
    ])
    const { files, dropped } = capFiles(code.files)

    res.status(200).json({
      mode: 'repo',
      owner, repo, branch: ref, defaultBranch, sha,
      htmlUrl: repoInfo.html_url,
      description: repoInfo.description || '',
      files,
      allPaths: code.allPaths,
      hygiene: code.hygiene,
      stylesheetTemplate: code.stylesheetTemplate,
      skipped: { tooLarge: dropped },
      git,
      nodeModulesCommitted: code.nodeModulesCommitted,
    })
  } catch (err) {
    sendError(res, err)
  }
}

async function fetchPullRequest({ owner, repo, number }, repoInfo) {
  const { pr, files: prFiles, commits, reviews } = await gatherPrFacts({ owner, repo, number })
  const headSha = pr.head.sha
  const headRepo = pr.head.repo?.full_name

  // One tarball at the PR's head contains the base app AND the changed files.
  let code
  try {
    code = await downloadRepo({ owner, repo, sha: headSha })
  } catch (err) {
    if (!headRepo) throw err
    code = await downloadRepo({ owner, repo, sha: headSha, tarballRepo: headRepo })
  }

  const changedByPath = new Map(
    prFiles.map((f) => [f.filename, { status: f.status, additions: f.additions, deletions: f.deletions, ranges: changedRangesFromPatch(f.patch) }]),
  )
  const files = code.files.map((f) => {
    const c = changedByPath.get(f.path)
    if (!c || f.template) return f
    // whole-file ranges for new files or very large patches GitHub didn't send
    const ranges = c.ranges.length ? c.ranges : [[1, Math.max(1, f.content.split('\n').length)]]
    return { ...f, changed: ranges, changeStatus: c.status }
  })
  const { files: capped, dropped } = capFiles(files)
  const gitFacts = await gatherGitFacts({ owner, repo, defaultBranch: repoInfo.default_branch }).catch(() => null)

  return {
    mode: 'pr',
    owner, repo, sha: headSha,
    branch: pr.head.ref,
    defaultBranch: repoInfo.default_branch,
    htmlUrl: repoInfo.html_url,
    description: repoInfo.description || '',
    pr: {
      number,
      title: pr.title,
      url: pr.html_url,
      body: (pr.body || '').slice(0, 2500),
      baseRef: pr.base.ref,
      headRef: pr.head.ref,
      state: pr.merged_at ? 'merged' : pr.state,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
      commitMessages: commits.map((c) => (c.commit?.message || '').split('\n')[0]).slice(0, 30),
      reviews: reviews.length,
      comments: (pr.comments || 0) + (pr.review_comments || 0),
      changedPaths: prFiles.map((f) => f.filename).slice(0, 100),
    },
    files: capped,
    allPaths: code.allPaths,
    hygiene: code.hygiene,
    stylesheetTemplate: code.stylesheetTemplate,
    skipped: { tooLarge: dropped },
    git: gitFacts,
    nodeModulesCommitted: code.nodeModulesCommitted,
  }
}
