// Runs the browser orchestration in Node against a running dev server, then
// server-renders the report components to catch runtime errors.
//   node scripts/smoke-ui.mjs http://localhost:5173 <github-url>
import React from 'react'
import { renderToString } from 'react-dom/server'

const [base, url] = process.argv.slice(2)
const realFetch = globalThis.fetch
globalThis.fetch = (u, o) => realFetch(String(u).startsWith('/') ? base + u : u, o)

import { createServer } from 'vite'
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { runAnalysis } = await vite.ssrLoadModule('/src/lib/run.js')
const { toMarkdown } = await vite.ssrLoadModule('/src/lib/markdown.js')
const { default: ReportView } = await vite.ssrLoadModule('/src/components/ReportView.jsx')
const { default: Presentation } = await vite.ssrLoadModule('/src/components/Presentation.jsx')

const events = []
const report = await runAnalysis({ url, team: 'Team Test' }, (e) => events.push(e))
console.log('events:', events.map((e) => e.type + (e.id ? `:${e.id}:${e.status}` : '')).join(' ').slice(0, 400))
console.log('overall', report.overall, 'homemade', report.homemade, 'removed', report.removedTotal, 'missions', report.missions.length)
console.log(report.categories.map((c) => `${c.id}=${c.error ? 'ERR ' + c.error : c.applicable ? c.grade + '/' + c.score : 'N/A'}`).join('  '))
const html = renderToString(React.createElement(ReportView, { report, animate: false }))
console.log('ReportView html bytes:', html.length)
try {
  // Presentation uses effects only (SSR-safe)
  console.log('Presentation html bytes:', renderToString(React.createElement(Presentation, { report, onExit() {} })).length)
} catch (e) { console.log('Presentation failed', e.message) }
console.log('markdown bytes:', toMarkdown(report).length)
console.log(toMarkdown(report).slice(0, 700))

await vite.close()
