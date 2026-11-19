// Full server-side pipeline for ONE category without the browser:
//   MOCK_LLM=1 GITHUB_TOKEN=$(gh auth token) node scripts/test-analyze.js <repo-or-pr-url> [category]
import fetchRepo from '../api/fetch-repo.js'
import analyze from '../api/analyze.js'
import { runChecks, limitChecksToPR, factsForCategory } from '../shared/checks.js'
import { CATEGORY_BY_ID } from '../shared/config.js'
import { selectFiles } from '../shared/select.js'

const call = (handler, body) => new Promise((resolve) => handler({ method: 'POST', body }, { status: (c) => ({ json: (b) => resolve({ code: c, body: b }) }) }))
const [url, catId = 'frontend'] = process.argv.slice(2)
const f = await call(fetchRepo, { url })
if (f.code !== 200) { console.log(f); process.exit(1) }
const d = f.body
let r = runChecks(d.files, { paths: d.allPaths, hygiene: d.hygiene })
if (d.mode === 'pr') r = limitChecksToPR(r, d.files)
const cat = CATEGORY_BY_ID[catId]
const { selected, left } = selectFiles(cat, d.files, { mode: d.mode })
console.log(`selected ${selected.length} files for ${catId} (${left.length} left out)`)
const a = await call(analyze, {
  category: catId, files: selected, versions: r.versions, facts: factsForCategory(r, cat), mode: d.mode, pr: d.pr, git: d.git,
  tree: d.files.filter((x) => !x.template).map((x) => x.path), repo: { owner: d.owner, repo: d.repo, sha: d.sha },
})
console.log(JSON.stringify(a, null, 1))
