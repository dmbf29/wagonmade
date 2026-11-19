// Phase 2 checks against a running dev server (MOCK_LLM=1 works):
//   node scripts/smoke-phase2.mjs http://localhost:5199 <github-url>
import React from 'react'
import { renderToString } from 'react-dom/server'
const [base, url] = process.argv.slice(2)
const realFetch = globalThis.fetch
globalThis.fetch = (u, o) => realFetch(String(u).startsWith('/') ? base + u : u, o)
import { createServer } from 'vite'
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { runAnalysis, rerunCategory } = await vite.ssrLoadModule('/src/lib/run.js')
const R = await vite.ssrLoadModule('/src/lib/report.js')
const el = async (p, props) => renderToString(React.createElement((await vite.ssrLoadModule(p)).default, props))
const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) process.exitCode = 1 }

const a = await runAnalysis({ url, team: 'Team A' }, () => {})
// weights: zero everything but wagonmade -> overall equals wagonmade
const only = Object.fromEntries(Object.keys(R.defaultWeights()).map((k) => [k, k === 'wagonmade' ? 1 : 0]))
const w = R.withWeights(a, only)
ok(w.overall.score === a.wagonmade.score, `weights: overall ${w.overall.score} == wagonmade ${a.wagonmade.score}`)
ok(R.withWeights(a, R.defaultWeights()) === a, 'default weights leave the report untouched')

// rerun one category and swap it in
const r = await rerunCategory(a, 'rails_way')
const a2 = R.replaceCategory(a, r)
ok(a2.categories.find((c) => c.id === 'rails_way').grade === r.grade && a2.key === a.key, 'rerun + replaceCategory keeps key, updates category')

// diff: fake a "later" report with the first level-up resolved and a score bump
const b = JSON.parse(JSON.stringify(a))
b.key += 'x'; b.repo.sha = 'bbbbbbb1'; b.createdAt = new Date(Date.now() + 1000).toISOString()
const cat = b.categories.find((c) => c.levelUps.length)
const gone = cat.levelUps.shift(); cat.score = Math.min(100, cat.score + 6)
b.overall = { score: R.overallScore(b.categories), grade: 'A' }
ok(R.previousReport(b, [a, b])?.key === a.key, 'previousReport finds the older run')
const d = R.diffReports(a, b)
ok(d.resolved.some((l) => l.title === gone.title) && d.categories.some((c) => c.delta === 6), `diff: resolved "${gone.title}", +6 in ${cat.id}`)

// components render
const html = [
  await el('/src/components/Compare.jsx', { a, b, weights: R.defaultWeights(), onBack() {}, onOpen() {} }),
  await el('/src/components/Changes.jsx', { diff: d, prev: a, onOpenPrev() {} }),
  await el('/src/components/Weights.jsx', { weights: R.defaultWeights(), onChange() {}, onReset() {}, onClose() {} }),
  await el('/src/components/ReportView.jsx', { report: b, animate: false, weights: R.defaultWeights(), diff: d, prev: a, onRerun() {} }),
]
ok(html.every((h) => h.length > 500), `components render (${html.map((h) => h.length).join(', ')} bytes)`)
ok(html[3].includes('What changed') && html[1].includes('Level-ups you tackled'), 'what-changed panel present')
await vite.close()
