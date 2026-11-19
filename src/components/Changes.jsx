import React from 'react'
import { GradeBadge } from './CategoryCard.jsx'

const sign = (n) => (n > 0 ? `+${n}` : String(n))

// "What changed since the last report" for the same project. Warm tone: celebrate progress first.
export default function Changes({ diff, prev, onOpenPrev }) {
  const moved = diff.categories.filter((c) => c.delta !== 0)
  const nothing = !moved.length && !diff.resolved.length && !diff.added.length && !diff.newWins.length
  const when = new Date(prev.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
  return (
    <section className="card panel changes" aria-label="What changed">
      <header className="panel-head">
        <h3>What changed since the last check</h3>
        <button className="btn btn-link" onClick={() => onOpenPrev(prev)}>Open that report ({when})</button>
      </header>
      {diff.sameCode && <p className="muted small">Same version of the code, so differences come from re-running the check.</p>}
      {nothing && <p>Nothing moved. Same story as last time.</p>}
      {diff.delta != null && diff.delta !== 0 && (
        <p className="change-headline">Wagonmade Score <strong className={diff.delta > 0 ? 'up' : 'down'}>{sign(diff.delta)}</strong> points{diff.delta > 0 ? ' 🎉' : ''}</p>
      )}
      {moved.length > 0 && (
        <ul className="change-cats">
          {moved.map((c) => (
            <li key={c.id}>
              <span>{c.name}</span>
              <span className="change-from"><GradeBadge grade={c.gradeFrom} size="sm" /> {c.from}</span>
              <span aria-hidden="true">→</span>
              <span className="change-to"><GradeBadge grade={c.gradeTo} size="sm" /> {c.to}</span>
              <strong className={c.delta > 0 ? 'up' : 'down'}>{sign(c.delta)}</strong>
            </li>
          ))}
        </ul>
      )}
      {diff.resolved.length > 0 && (
        <>
          <h4 className="section-label">Level-ups you tackled</h4>
          <ul className="change-list">{diff.resolved.map((l, i) => <li key={i}>✅ {l.title} <small className="muted">· {l.categoryName}</small></li>)}</ul>
        </>
      )}
      {diff.newWins.length > 0 && (
        <>
          <h4 className="section-label">New wins</h4>
          <ul className="change-list">{diff.newWins.slice(0, 5).map((w, i) => <li key={i}>🌟 {w.title} <small className="muted">· {w.categoryName}</small></li>)}</ul>
        </>
      )}
      {diff.added.length > 0 && (
        <>
          <h4 className="section-label">New things to try</h4>
          <ul className="change-list">{diff.added.map((l, i) => <li key={i}>🚀 {l.title} <small className="muted">· {l.categoryName}</small></li>)}</ul>
        </>
      )}
    </section>
  )
}
