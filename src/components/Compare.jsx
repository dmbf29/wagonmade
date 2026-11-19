import React from 'react'
import { CATEGORIES } from '../../shared/config.js'
import { displayName, diffReports, isSameProject, overallScore } from '../lib/report.js'
import { gradeFor } from '../../shared/config.js'
import { GradeBadge } from './CategoryCard.jsx'
import Changes from './Changes.jsx'

const sign = (n) => (n > 0 ? `+${n}` : String(n))

function Cell({ cat }) {
  if (!cat) return <td className="cmp-cell muted">–</td>
  if (cat.error) return <td className="cmp-cell muted">didn't finish</td>
  if (!cat.applicable) return <td className="cmp-cell muted">n/a</td>
  return (
    <td className="cmp-cell">
      <GradeBadge grade={cat.grade} />
      <span className="cmp-score">{cat.score}</span>
    </td>
  )
}

// Two saved reports side by side. For the same project (two commits), also shows the difference.
export default function Compare({ a, b, weights, onBack, onOpen }) {
  const same = isSameProject(a, b)
  const [older, newer] = same && String(a.createdAt) > String(b.createdAt) ? [b, a] : [a, b]
  const diff = same ? diffReports(older, newer) : null
  const delta = (id) => diff?.categories.find((c) => c.id === id)?.delta
  const overall = (r) => { const s = overallScore(r.categories, weights); return s == null ? null : { score: s, grade: gradeFor(s) } }
  const oa = overall(older)
  const ob = overall(newer)

  return (
    <main className="report compare">
      <div className="toolbar"><button className="btn" onClick={onBack}>← Back</button><h2 className="compare-title">Side by side</h2></div>
      <div className="card">
        <table className="cmp">
          <thead>
            <tr>
              <th />
              {[older, newer].map((r) => (
                <th key={r.key}>
                  <button className="btn btn-link" onClick={() => onOpen(r)}>{displayName(r)}</button>
                  <small className="muted">{r.repo.owner}/{r.repo.name}{r.pr ? ` · PR #${r.pr.number}` : ''} · {r.repo.sha.slice(0, 7)}<br />{new Date(r.createdAt).toLocaleDateString([], { dateStyle: 'medium' })}</small>
                </th>
              ))}
              {same && <th>Change</th>}
            </tr>
          </thead>
          <tbody>
            <tr className="cmp-total">
              <th scope="row">Overall</th>
              {[oa, ob].map((o, i) => <td key={i} className="cmp-cell">{o ? <><GradeBadge grade={o.grade} /><span className="cmp-score">{o.score}</span></> : '–'}</td>)}
              {same && <td className="cmp-delta">{oa && ob && ob.score !== oa.score ? <strong className={ob.score > oa.score ? 'up' : 'down'}>{sign(ob.score - oa.score)}</strong> : '·'}</td>}
            </tr>
            {CATEGORIES.map((def) => {
              const ca = older.categories.find((c) => c.id === def.id)
              const cb = newer.categories.find((c) => c.id === def.id)
              const d = delta(def.id)
              return (
                <tr key={def.id}>
                  <th scope="row">{def.name}</th>
                  <Cell cat={ca} /><Cell cat={cb} />
                  {same && <td className="cmp-delta">{d ? <strong className={d > 0 ? 'up' : 'down'}>{sign(d)}</strong> : '·'}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
        {!same && <p className="muted small">These are different projects: compare the shape, not just the numbers.</p>}
      </div>
      {diff && <Changes diff={diff} prev={older} onOpenPrev={onOpen} />}
      <div className="cmp-missions">
        {[older, newer].map((r) => (
          <section key={r.key} className="card">
            <h3>Missions · {displayName(r)}</h3>
            {r.missions.length ? <ol>{r.missions.map((m, i) => <li key={i}>{m.mission}</li>)}</ol> : <p className="muted">Nothing urgent. 🎉</p>}
          </section>
        ))}
      </div>
    </main>
  )
}
