import React, { useCallback, useEffect, useState } from 'react'
import { displayName } from '../lib/report.js'
import { Evidence } from './CategoryCard.jsx'
import Code from './Code.jsx'

// One slide at a time, big type, code hidden until you press C.
export default function Presentation({ report, onExit }) {
  const cats = report.categories.filter((c) => c.applicable && !c.error)
  const slides = [{ type: 'title' }, ...cats.map((c) => ({ type: 'cat', cat: c })), { type: 'missions' }]
  const [i, setI] = useState(0)
  const [code, setCode] = useState(false)

  const go = useCallback((d) => setI((n) => Math.min(slides.length - 1, Math.max(0, n + d))), [slides.length])
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(1) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1) }
      else if (e.key === 'c' || e.key === 'C') setCode((v) => !v)
      else if (e.key === 'Home') setI(0)
      else if (e.key === 'End') setI(slides.length - 1)
      else if (e.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, onExit, slides.length])
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {})
    const onFs = () => { if (!document.fullscreenElement) onExit() }
    document.addEventListener('fullscreenchange', onFs)
    return () => { document.removeEventListener('fullscreenchange', onFs); if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}) }
  }, [onExit])

  const s = slides[i]
  return (
    <div className="present" role="dialog" aria-label="Presentation mode" aria-live="polite">
      <div className="present-slide" key={i}>
        {s.type === 'title' && (
          <div className="present-title">
            <p className="eyebrow">Report card</p>
            <h1>{displayName(report)}</h1>
            <div className="present-grades">
              {report.homemade && <div><p className="eyebrow">Sounds like you</p><span className={`grade grade-xl grade-${report.homemade.grade.toLowerCase()}`}>{report.homemade.grade}</span><p className="present-score">{report.homemade.score}</p></div>}
              {report.overall && <div><p className="eyebrow">Overall</p><span className={`grade grade-xl grade-${report.overall.grade.toLowerCase()}`}>{report.overall.grade}</span><p className="present-score">{report.overall.score}</p></div>}
            </div>
          </div>
        )}
        {s.type === 'cat' && (() => {
          const c = s.cat
          const ups = c.levelUps.filter((l) => l.confidence !== 'low').slice(0, 3)
          return (
            <div className="present-cat">
              <header><span className={`grade grade-xl grade-${c.grade.toLowerCase()}`}>{c.grade}</span><div><h1>{c.name}</h1><p className="present-verdict">{c.verdict}</p></div></header>
              <div className="present-cols">
                <section><h2>🌟 Wins</h2>{c.wins.length ? c.wins.map((w, k) => <div key={k} className="present-item"><h3>{w.title}</h3><p>{w.detail}</p>{code && <Evidence evidence={w.evidence} />}</div>) : <p className="muted">Keep building!</p>}</section>
                <section><h2>🚀 Level-ups</h2>{ups.length ? ups.map((l, k) => <div key={k} className="present-item"><h3>{l.title}</h3><p>{l.why}</p><p className="concept">You already know: <strong>{l.concept}</strong></p>{code && <><Evidence evidence={l.evidence} />{l.example && <Code code={l.example} label="The way we learned it" file={l.evidence?.file} />}</>}</div>) : <p className="muted">Nothing to level-up here.</p>}</section>
              </div>
            </div>
          )
        })()}
        {s.type === 'missions' && (
          <div className="present-missions">
            <h1>Your missions for the final project</h1>
            <ol>{report.missions.map((m, k) => <li key={k}><span className="mission-n">{k + 1}</span><div><p>{m.mission}</p><small>{m.categoryName}</small></div></li>)}</ol>
            {!report.missions.length && <p className="present-verdict">Nothing urgent: keep trusting what you know! 🎉</p>}
          </div>
        )}
      </div>
      <footer className="present-foot">
        <span>← → to move · C {code ? 'hides' : 'shows'} code · Esc to leave</span>
        <span className="dots">{slides.map((_, k) => <button key={k} className={k === i ? 'dot on' : 'dot'} onClick={() => setI(k)} aria-label={`Slide ${k + 1}`} />)}</span>
        <button className="btn btn-ghost-light" onClick={onExit}>Exit</button>
      </footer>
    </div>
  )
}
