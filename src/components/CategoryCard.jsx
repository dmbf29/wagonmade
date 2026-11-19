import React, { useState } from 'react'
import Code from './Code.jsx'

export function GradeBadge({ grade, size = 'md' }) {
  return <span className={`grade grade-${String(grade).replace('/', '').toLowerCase()} grade-${size}`} aria-label={`Grade ${grade}`}>{grade}</span>
}

export function Evidence({ evidence }) {
  if (!evidence) return null
  if (!evidence.file) return evidence.snippet ? <blockquote className="fact-quote">{evidence.snippet}</blockquote> : null
  const lines = evidence.startLine ? `:${evidence.startLine}${evidence.endLine > evidence.startLine ? `-${evidence.endLine}` : ''}` : ''
  return (
    <div className="evidence">
      <a className="evidence-link" href={evidence.url} target="_blank" rel="noreferrer">{evidence.file}{lines} ↗</a>
      <Code code={evidence.snippet} file={evidence.file} />
    </div>
  )
}

function Win({ win }) {
  return (
    <li className="win">
      <h4>🌟 {win.title}</h4>
      <p>{win.detail}</p>
      <Evidence evidence={win.evidence} />
    </li>
  )
}

export function ExplainThis({ item }) {
  return (
    <li className="explain-item">
      <h4>🎓 {item.title}</h4>
      <p>{item.whatItDoes}</p>
      <p className="explain-q">{item.question}</p>
      <Evidence evidence={item.evidence} />
    </li>
  )
}

export function LevelUp({ item, showExample = true }) {
  return (
    <li className="levelup">
      <h4>🚀 {item.title} {item.confidence === 'low' && <span className="chip chip-soft">worth a second look</span>}</h4>
      <p>{item.why}</p>
      <p className="concept">You already know: <strong>{item.concept}</strong></p>
      <Evidence evidence={item.evidence} />
      {showExample && item.example && <Code code={item.example} label="The way we learned it" file={item.evidence?.file} />}
    </li>
  )
}

export default function CategoryCard({ cat, index, open, onToggle, onRerun, busy }) {
  const [showLow, setShowLow] = useState(false)
  const confident = cat.levelUps.filter((l) => l.confidence !== 'low')
  const low = cat.levelUps.filter((l) => l.confidence === 'low')
  const na = !cat.applicable
  const failed = !!cat.error

  return (
    <article className={`card cat ${open ? 'is-open' : ''} ${na ? 'is-na' : ''}`} style={{ '--i': index }}>
      <button className="cat-head" onClick={onToggle} aria-expanded={open} disabled={failed}>
        <GradeBadge grade={failed ? '?' : cat.grade} />
        <span className="cat-text">
          <span className="cat-name">{cat.name}</span>
          <span className="cat-tagline">{cat.tagline}</span>
        </span>
        {!na && !failed && <span className="cat-score">{cat.score}</span>}
      </button>
      {!na && !failed && <div className="bar" role="presentation"><span className={`bar-fill bar-${cat.grade.toLowerCase()}`} style={{ width: `${cat.score}%` }} /></div>}
      <p className="cat-verdict">{failed ? `We couldn't finish this one: ${cat.error}` : cat.verdict}</p>

      {onRerun && (failed || (open && !na)) && (
        <button className="btn btn-link rerun" onClick={onRerun} disabled={busy}>{busy ? 'Looking again…' : failed ? '↻ Try this category again' : '↻ Re-run this category'}</button>
      )}

      {open && !na && !failed && (
        <div className="cat-body">
          {cat.wins.length > 0 && <><h3 className="section-label">Wins</h3><ul className="findings">{cat.wins.map((w, i) => <Win key={i} win={w} />)}</ul></>}
          {confident.length > 0 && <><h3 className="section-label">Level-ups</h3><ul className="findings">{confident.map((l, i) => <LevelUp key={i} item={l} />)}</ul></>}
          {confident.length === 0 && <p className="muted">Nothing to level-up here. Nice.</p>}
          {cat.explainThis?.length > 0 && (
            <>
              <h3 className="section-label">Make sure you can explain these</h3>
              <p className="muted small">Great, ambitious code, and ahead of what we taught. It's yours, so be ready to walk the class through how it works.</p>
              <ul className="findings">{cat.explainThis.map((x, i) => <ExplainThis key={i} item={x} />)}</ul>
            </>
          )}
          {low.length > 0 && (
            <>
              <button className="btn btn-link" onClick={() => setShowLow(!showLow)}>{showLow ? 'Hide' : 'Show'} {low.length} more idea{low.length > 1 ? 's' : ''} we're less sure about</button>
              {showLow && <ul className="findings">{low.map((l, i) => <LevelUp key={i} item={l} />)}</ul>}
            </>
          )}
          {cat.removed > 0 && <p className="muted small">{cat.removed} finding{cat.removed > 1 ? 's' : ''} removed because we couldn't verify {cat.removed > 1 ? 'them' : 'it'} in the code.</p>}
        </div>
      )}
    </article>
  )
}

export function PlaceholderCard({ def, index }) {
  return (
    <article className="card cat is-pending" style={{ '--i': index }} aria-busy="true">
      <div className="cat-head">
        <span className="grade grade-pending grade-md">…</span>
        <span className="cat-text"><span className="cat-name">{def.name}</span><span className="cat-tagline">{def.tagline}</span></span>
      </div>
      <div className="bar"><span className="bar-fill shimmer" style={{ width: '100%' }} /></div>
      <p className="cat-verdict muted">Reading your code…</p>
    </article>
  )
}
