import React from 'react'
import { CATEGORIES } from '../../shared/config.js'

// Sliders for how much each category counts in the Wagonmade Score. 0 = leave it out.
export default function Weights({ weights, onChange, onReset, onClose }) {
  const set = (id, v) => onChange({ ...weights, [id]: v })
  return (
    <section className="card panel" aria-label="Category weights">
      <header className="panel-head">
        <h3>How much should each category count?</h3>
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
      </header>
      <p className="muted small">Changes the Wagonmade Score only. Saved in this browser, and the category scores never change.</p>
      <ul className="weights">
        {CATEGORIES.map((c) => (
          <li key={c.id}>
            <label htmlFor={`w-${c.id}`}>{c.name}</label>
            <input id={`w-${c.id}`} type="range" min="0" max="5" step="0.5" value={weights[c.id] ?? c.weight} onChange={(e) => set(c.id, Number(e.target.value))} />
            <output>{weights[c.id] ?? c.weight}{(weights[c.id] ?? c.weight) === c.weight ? '' : ` (was ${c.weight})`}</output>
          </li>
        ))}
      </ul>
      <button className="btn" onClick={onReset}>Back to the defaults</button>
    </section>
  )
}
