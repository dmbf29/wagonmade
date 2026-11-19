// Small GitHub helpers: URL parsing, authenticated requests, friendly errors.

export class HttpError extends Error {
  constructor(status, message, hint) {
    super(message)
    this.status = status
    this.hint = hint
  }
}

// Detects repo vs PR mode from the URL
export function parseGithubUrl(input) {
  const raw = String(input || '').trim()
  let url
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    throw new HttpError(400, "That doesn't look like a URL.", 'Try https://github.com/owner/repo or a pull request link.')
  }
  if (!/^(www\.)?github\.com$/i.test(url.hostname)) {
    throw new HttpError(400, 'Only github.com links work for now.', 'Paste a repo or pull request URL from GitHub.')
  }
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts.length < 2) throw new HttpError(400, 'That link needs an owner and a repo.', 'Like https://github.com/owner/repo')
  const owner = parts[0]
  const repo = parts[1].replace(/\.git$/, '')
  if (parts[2] === 'pull' && /^\d+$/.test(parts[3] || '')) {
    return { mode: 'pr', owner, repo, number: Number(parts[3]) }
  }
  const ref = parts[2] === 'tree' && parts[3] ? decodeURIComponent(parts.slice(3).join('/')) : null
  return { mode: 'repo', owner, repo, ref }
}

export function githubHeaders(extra = {}) {
  const h = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'homemade-code-check',
    ...extra,
  }
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  return h
}

export function explainGithubError(res, what) {
  if (res.status === 404) {
    return new HttpError(404, `GitHub couldn't find ${what}.`, 'Check the link. If the repo is private, the GITHUB_TOKEN needs access to it.')
  }
  if (res.status === 403 || res.status === 429) {
    const left = res.headers.get('x-ratelimit-remaining')
    if (left === '0' || res.status === 429) {
      return new HttpError(429, 'GitHub says we asked too often.', 'Add a GITHUB_TOKEN env var (60 requests/hour without one), or wait a few minutes.')
    }
    return new HttpError(403, `GitHub wouldn't let us read ${what}.`, 'The GITHUB_TOKEN may not have access to this repository.')
  }
  if (res.status === 401) return new HttpError(502, 'The GITHUB_TOKEN was rejected by GitHub.', 'Create a new fine-grained read-only token and update the env var.')
  return new HttpError(502, `GitHub answered ${res.status} while reading ${what}.`)
}

export async function gh(path, { what = path, accept, optional = false } = {}) {
  const res = await fetch(path.startsWith('http') ? path : `https://api.github.com${path}`, {
    headers: githubHeaders(accept ? { Accept: accept } : {}),
  })
  if (!res.ok) {
    if (optional) return null
    throw explainGithubError(res, what)
  }
  return accept && !/json/.test(accept) ? res.text() : res.json()
}

// Follows pages (100 per page) up to maxPages
export async function ghPaged(path, { maxPages = 2, what } = {}) {
  const out = []
  for (let page = 1; page <= maxPages; page++) {
    const sep = path.includes('?') ? '&' : '?'
    const items = await gh(`${path}${sep}per_page=100&page=${page}`, { what, optional: page > 1 })
    if (!items || !items.length) break
    out.push(...items)
    if (items.length < 100) break
  }
  return out
}

export function sendError(res, err) {
  const status = err instanceof HttpError ? err.status : 500
  if (!(err instanceof HttpError)) console.error(err)
  res.status(status).json({
    error: err instanceof HttpError ? err.message : 'Something unexpected went wrong on the server.',
    hint: err instanceof HttpError ? err.hint : err?.message,
  })
}
