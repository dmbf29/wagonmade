// Split-run check against a dev server with MOCK_LLM=1:  node scripts/smoke-split.mjs http://localhost:5199 <github-url>
const [base, url] = process.argv.slice(2)
const realFetch = globalThis.fetch
globalThis.fetch = (u, o) => realFetch(String(u).startsWith('/') ? base + u : u, o)
import { createServer } from 'vite'
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { runAnalysis } = await vite.ssrLoadModule('/src/lib/run.js')
const { toMarkdown } = await vite.ssrLoadModule('/src/lib/markdown.js')
const S = await vite.ssrLoadModule('/src/lib/split.js')
const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) process.exitCode = 1 }

const files = [8, 7, 6, 3, 2, 1].map((k, i) => ({ path: `f${i}`, content: 'x'.repeat(k * 5000) }))
const groups = S.splitFiles(files, 2)
const sizes = groups.map((g) => g.reduce((n, f) => n + f.content.length, 0))
ok(Math.abs(sizes[0] - sizes[1]) <= 5000, `parts balanced ${sizes}`)
ok(S.partsFor([{ content: 'x'.repeat(10000) }]) === 1 && S.partsFor(files) === 3, 'partsFor: small = 1, big = 3')

const lu = (file, concept, impact) => ({ title: concept, concept, impact, confidence: 'high', evidence: { file } })
const m = S.mergeFindings([
  { wins: [{ title: 'A' }, { title: 'B' }], levelUps: [lu('a.rb', 'resources', 3)], removed: 1, filesSeen: 2 },
  { wins: [{ title: 'C' }, { title: 'a' }], levelUps: [lu('a.rb', 'Resources', 5), lu('b.rb', 'strong params', 2)], removed: 2, filesSeen: 3 },
])
ok(m.wins.map((w) => w.title).join() === 'A,C,B', `wins alternate + dedupe: ${m.wins.map((w) => w.title)}`)
ok(m.levelUps.length === 2 && m.levelUps[0].impact === 5, 'level-ups deduped, best kept')
ok(m.removed === 3 && m.filesSeen === 5, 'counts summed')

const report = await runAnalysis({ url, team: 'Split' }, () => {})
const big = report.categories.map((c) => `${c.id}:${c.error ? 'ERR ' + c.error : c.grade + '/' + c.score}`)
console.log(big.join('  '))
ok(report.categories.every((c) => !c.error), 'no category errors')
ok(report.quickChecks.length > 0 && toMarkdown(report).includes('quick checks noticed'), `quickChecks saved (${report.quickChecks.length}) and in markdown`)
await vite.close()
