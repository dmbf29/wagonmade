import React, { useEffect, useRef, useState } from 'react'
import { displayName } from '../lib/report.js'
import { GradeBadge } from './CategoryCard.jsx'

export default function History({ reports, onOpen, onDelete, onExportAll, onImport, onClose, onCompare, message }) {
  const file = useRef(null)
  const [picked, setPicked] = useState([])
  const toggle = (k) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k].slice(-2)))
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="History">
        <header className="drawer-head"><h2>History</h2><button className="btn btn-ghost" onClick={onClose}>Close</button></header>
        <div className="drawer-actions">
          <button className="btn" onClick={onExportAll} disabled={!reports.length}>Export all (JSON)</button>
          <button className="btn" onClick={() => file.current?.click()}>Import report…</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = '' }} />
        </div>
        {picked.length > 0 && (
          <div className="compare-bar">
            <span className="small">{picked.length === 2 ? 'Ready to compare.' : 'Pick one more report to compare.'}</span>
            <button className="btn btn-primary" disabled={picked.length !== 2} onClick={() => onCompare(...picked.map((k) => reports.find((r) => r.key === k)))}>Compare 2</button>
          </div>
        )}
        {message && <p className="notice small" role="status">{message}</p>}
        {!reports.length && <p className="muted">Reports you run are saved here, in this browser only. Export them to carry them to another computer.</p>}
        {reports.length > 1 && <p className="muted small">Tick two reports to compare them side by side.</p>}
        <ul className="history-list">
          {[...reports].sort((a, b) => displayName(a).localeCompare(displayName(b))).map((r) => (
            <li key={r.key} className="history-item">
              <input type="checkbox" className="history-pick" checked={picked.includes(r.key)} onChange={() => toggle(r.key)} aria-label={`Select ${displayName(r)} to compare`} />
              <button className="history-open" onClick={() => onOpen(r)}>
                {r.overall ? <GradeBadge grade={r.overall.grade} /> : <span className="grade grade-pending grade-md">–</span>}
                <span className="history-text"><strong>{displayName(r)}</strong><small>{r.repo.owner}/{r.repo.name}{r.pr ? ` · PR #${r.pr.number}` : ''} · {new Date(r.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</small></span>
              </button>
              <button className="btn btn-ghost small" onClick={() => onDelete(r.key)} aria-label={`Delete report for ${displayName(r)}`}>✕</button>
            </li>
          ))}
        </ul>
      </aside>
    </>
  )
}
