import React, { useEffect, useState } from 'react'
import { CATEGORIES } from '../../shared/config.js'
import { useCountUp } from '../lib/useCountUp.js'
import { displayName } from '../lib/report.js'
import Weights from './Weights.jsx'
import Changes from './Changes.jsx'
import CategoryCard, { GradeBadge, LevelUp, PlaceholderCard } from './CategoryCard.jsx'

function Hero({ report, animate }) {
  const overall = useCountUp(report.overall?.score ?? 0, { enabled: animate, delay: 300 })
  const wagonmade = useCountUp(report.wagonmade?.score ?? 0, { enabled: animate, delay: 900, duration: 1800 })
  return (
    <section className={`hero ${animate ? 'animate' : ''}`}>
      <div className="hero-id">
        <p className="eyebrow">{report.mode === 'pr' ? `Pull request #${report.pr.number}` : 'Report card'}</p>
        <h1 className="hero-name">{displayName(report)}</h1>
        <p className="hero-sub">
          <a href={report.pr?.url || report.repo.url} target="_blank" rel="noreferrer">{report.repo.owner}/{report.repo.name}{report.pr ? ` · ${report.pr.title}` : ''} ↗</a>
        </p>
        {Object.keys(report.versions).length > 0 && (
          <p className="chips">{Object.entries(report.versions).slice(0, 6).map(([g, v]) => <span key={g} className="chip">{g} {v.split('.').slice(0, 2).join('.')}</span>)}</p>
        )}
      </div>
      <div className="hero-scores">
        {report.wagonmade && (
          <div className="score-panel score-wagonmade">
            <p className="eyebrow">Wagonmade Score · how well it fits what we learned</p>
            <div className="score-row">
              <span className="big-number">{wagonmade}</span>
              <span className="stamp-wrap"><span className={`stamp grade grade-${report.wagonmade.grade.toLowerCase()}`}>{report.wagonmade.grade}</span></span>
            </div>
          </div>
        )}
        {report.overall && (
          <div className="score-panel">
            <p className="eyebrow">Overall · average of all {report.categories.filter((c) => c.applicable && !c.error).length} categories</p>
            <div className="score-row">
              <span className="big-number small">{overall}</span>
              <GradeBadge grade={report.overall.grade} size="lg" />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function Missions({ missions }) {
  if (!missions.length) {
    return (
      <section className="missions">
        <h2>Your missions for the final project</h2>
        <p className="mission-empty">Nothing urgent. Keep trusting what you know, and keep building. 🎉</p>
      </section>
    )
  }
  return (
    <section className="missions">
      <h2>Your {missions.length === 1 ? 'mission' : `${missions.length} missions`} for the final project</h2>
      <ol className="mission-list">
        {missions.map((m, i) => (
          <li key={i} className="mission"><span className="mission-n">{i + 1}</span><div><p className="mission-text">{m.mission}</p><p className="mission-meta">{m.categoryName} · {m.title}</p></div></li>
        ))}
      </ol>
    </section>
  )
}

export default function ReportView({ report, live, animate, onPresent, onCopy, onExport, copied, weights, onWeights, onResetWeights, diff, prev, onOpen, onRerun, rerunning, rerunError }) {
  const [openId, setOpenId] = useState(null)
  const [showWeights, setShowWeights] = useState(false)
  const running = !!live
  const byId = Object.fromEntries((running ? live.categories : report.categories).map((c) => [c.id, c]))
  useEffect(() => { setOpenId(null) }, [report?.key])

  return (
    <main className="report">
      {!running && <Hero report={report} animate={animate} />}
      {!running && (
        <div className="toolbar">
          <button className="btn btn-primary" onClick={onPresent}>▶ Presentation mode</button>
          <button className="btn" onClick={onCopy}>{copied ? 'Copied ✓' : 'Copy as Markdown'}</button>
          <button className="btn" onClick={onExport}>Export JSON</button>
          <button className="btn" onClick={() => setShowWeights(!showWeights)} aria-expanded={showWeights}>⚖ Weights{report.weighted ? ' •' : ''}</button>
          {!report.complete && <span className="muted small">Some categories didn't finish: this report is partial.</span>}
        </div>
      )}
      {!running && showWeights && <Weights weights={weights} onChange={onWeights} onReset={onResetWeights} onClose={() => setShowWeights(false)} />}
      {!running && diff && <Changes diff={diff} prev={prev} onOpenPrev={onOpen} />}
      {!running && rerunError && <p className="notice small" role="alert"><strong>{rerunError.message}</strong> {rerunError.hint}</p>}
      <div className="grid">
        {CATEGORIES.map((def, i) => {
          const cat = byId[def.id]
          if (!cat) return <PlaceholderCard key={def.id} def={def} index={i} />
          return <CategoryCard key={def.id} cat={cat} index={i} headline={def.headline} onRerun={!running && onRerun ? () => onRerun(def.id) : null} busy={rerunning === def.id} open={openId === def.id} onToggle={() => setOpenId(openId === def.id ? null : def.id)} />
        })}
      </div>
      {!running && <Missions missions={report.missions} />}
      {!running && report.quickChecks?.length > 0 && (
        <details className="card quickchecks">
          <summary>🔎 What the quick checks noticed ({report.quickChecks.length})</summary>
          <p className="muted small">Plain code checks that run before the AI. The AI sees these as facts, and decides how much each one matters.</p>
          <ul>{report.quickChecks.map((q) => <li key={q.id} className={`qc qc-${q.severity}`}>{q.text}</li>)}</ul>
        </details>
      )}
      {!running && (report.removedTotal > 0 || report.skipped.tooLarge > 0) && (
        <p className="muted small footnote">
          {report.removedTotal > 0 && <>{report.removedTotal} unverifiable finding{report.removedTotal > 1 ? 's' : ''} removed. </>}
          {report.skipped.tooLarge > 0 && <>{report.skipped.tooLarge} large file{report.skipped.tooLarge > 1 ? 's were' : ' was'} skipped. </>}
          {report.skipped.templateStylesheets > 0 && <>{report.skipped.templateStylesheets} untouched template stylesheets weren't judged.</>}
        </p>
      )}
    </main>
  )
}

export { LevelUp }
