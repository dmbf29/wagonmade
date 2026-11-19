// "Copy as Markdown": paste a report into a GitHub issue or PR.

import { displayName } from './report.js'

const EVIDENCE = (e) => {
  if (!e || !e.file) return e?.snippet ? `> ${e.snippet}\n` : ''
  const where = e.startLine ? `${e.file}:${e.startLine}${e.endLine > e.startLine ? `-${e.endLine}` : ''}` : e.file
  const ext = e.file.split('.').pop()
  const lang = { rb: 'ruby', erb: 'erb', js: 'js', scss: 'scss', yml: 'yaml' }[ext] || ''
  return `[\`${where}\`](${e.url})\n\n\`\`\`${lang}\n${e.snippet}\n\`\`\`\n`
}

export function toMarkdown(r) {
  const out = []
  out.push(`# 🧰 Wagonmade report card: ${displayName(r)}`)
  out.push(`${r.mode === 'pr' ? `Pull request [#${r.pr.number} ${r.pr.title}](${r.pr.url}) in ` : ''}[${r.repo.owner}/${r.repo.name}](${r.repo.url}) · commit \`${r.repo.sha.slice(0, 7)}\``)
  if (r.overall) out.push(`\n**Overall: ${r.overall.grade} (${r.overall.score}/100)**${r.wagonmade ? ` · **How well it fits what we learned: ${r.wagonmade.grade} (${r.wagonmade.score}/100)**` : ''}`)
  out.push('\n| Category | Grade | Score |\n|---|---|---|')
  for (const c of r.categories) out.push(`| ${c.name} | ${c.error ? '–' : c.grade} | ${c.score ?? '–'} |`)

  for (const c of r.categories) {
    if (c.error || !c.applicable) continue
    out.push(`\n## ${c.name}: ${c.grade} (${c.score}/100)\n_${c.verdict}_`)
    if (c.wins.length) {
      out.push('\n### 🌟 Wins')
      for (const w of c.wins) out.push(`- **${w.title}**: ${w.detail}`)
    }
    const ups = c.levelUps.filter((l) => l.confidence !== 'low')
    if (ups.length) {
      out.push('\n### 🚀 Level-ups')
      for (const l of ups) {
        out.push(`\n#### ${l.title}\n${l.why}\n\n*You already know:* ${l.concept}\n\n${EVIDENCE(l.evidence)}`)
        if (l.example) out.push(`The way we learned it:\n\n\`\`\`\n${l.example}\n\`\`\``)
      }
    }
  }
  if (r.quickChecks?.length) {
    out.push('\n## 🔎 What the quick checks noticed')
    for (const q of r.quickChecks) out.push(`- ${q.text}`)
  }
  if (r.missions.length) {
    out.push('\n## 🎯 Your 3 missions for the final project')
    r.missions.forEach((m, i) => out.push(`${i + 1}. **${m.title}**: ${m.mission}`))
  }
  out.push('\n_Made with Wagonmade: your own knowledge is enough, trust it._')
  return out.join('\n')
}
