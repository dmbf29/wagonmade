import React, { useEffect, useState } from 'react'

const ICON = { running: '◔', done: '✓', failed: '!', pending: '○' }

// Reveals the quick-check findings one by one: the wait is part of the show.
function useDrip(items, ms = 650) {
  const [n, setN] = useState(0)
  useEffect(() => { setN(0) }, [items])
  useEffect(() => {
    if (n >= items.length) return undefined
    const t = setTimeout(() => setN(n + 1), ms)
    return () => clearTimeout(t)
  }, [n, items, ms])
  return items.slice(0, n)
}

export default function Progress({ steps, facts, versions, title }) {
  const shown = useDrip(facts)
  return (
    <section className="progress" aria-live="polite">
      <h2 className="progress-title">{title}</h2>
      <ul className="steps">
        {steps.map((s) => (
          <li key={s.id} className={`step step-${s.status}`}>
            <span className="step-icon" aria-hidden="true">{ICON[s.status]}</span>
            <span>{s.text}</span>
          </li>
        ))}
      </ul>
      {versions && Object.keys(versions).length > 0 && (
        <p className="chips">
          {Object.entries(versions).slice(0, 7).map(([g, v]) => <span key={g} className="chip">{g} {v.split('.').slice(0, 2).join('.')}</span>)}
        </p>
      )}
      {shown.length > 0 && (
        <ul className="facts">
          {shown.map((f) => <li key={f.id} className="fact">🔎 {f.text}</li>)}
        </ul>
      )}
    </section>
  )
}
