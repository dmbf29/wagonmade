// Runs fetch + deterministic checks against real repos, with no AI involved.
//   GITHUB_TOKEN=$(gh auth token) npm run check:repos -- https://github.com/dmbf29/watch-list-2358
// Handy as the first acceptance test: reference repos should have no serious issues.

import fetchRepo from '../api/fetch-repo.js'
import { runChecks, limitChecksToPR } from '../shared/checks.js'

const urls = process.argv.slice(2)
if (!urls.length) {
  urls.push('https://github.com/dmbf29/watch-list-2358', 'https://github.com/dmbf29/rails-wott-2358')
}

for (const url of urls) {
  const t0 = Date.now()
  const out = await new Promise((resolve) => {
    const res = { status: (c) => ({ json: (b) => resolve({ code: c, body: b }) }) }
    fetchRepo({ method: 'POST', body: { url } }, res)
  })
  if (out.code !== 200) { console.log(url, '→', out.code, out.body); continue }
  const d = out.body
  console.log(`\n══ ${url}  [${d.mode}]  fetched in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  console.log(`   files: ${d.files.length} (${d.files.filter((f) => f.template).length} template/untouched)  stylesheets identical to template: ${d.stylesheetTemplate.identical}`)
  console.log(`   skipped for size: ${d.skipped.tooLarge.length}  secretHits: ${d.hygiene.secretHits.length}`)
  let result = runChecks(d.files, { paths: d.allPaths, hygiene: d.hygiene })
  if (d.mode === 'pr') result = limitChecksToPR(result, d.files)
  console.log('   versions:', JSON.stringify(result.versions))
  console.log('   stats:', JSON.stringify(result.stats))
  console.log('   features:', JSON.stringify(result.features))
  for (const c of result.checks) {
    console.log(`   [${c.severity}] ${c.id} ×${c.count}  ${c.title}`)
    for (const l of c.locations.slice(0, 3)) console.log(`        ${l.path}:${l.line}  ${l.snippet.slice(0, 100)}`)
  }
  if (d.git) console.log('   git:', JSON.stringify(d.git).slice(0, 900))
}
