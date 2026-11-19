import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORIES } from '../shared/config.js'
import { rerunCategory, runAnalysis } from './lib/run.js'
import { defaultWeights, diffReports, previousReport, replaceCategory, withWeights } from './lib/report.js'
import { deleteReport, download, exportJson, importReports, lastReportForRepo, loadReports, loadWeights, parseImport, saveReport, saveWeights } from './lib/storage.js'
import { toMarkdown } from './lib/markdown.js'
import { parseTarget } from './lib/url.js'
import Header from './components/Header.jsx'
import Home from './components/Home.jsx'
import Progress from './components/Progress.jsx'
import ReportView from './components/ReportView.jsx'
import Presentation from './components/Presentation.jsx'
import History from './components/History.jsx'
import Compare from './components/Compare.jsx'

const emptyLive = () => ({ steps: [], facts: [], versions: null, categories: [], meta: null })

export default function App() {
  const [view, setView] = useState('home') // home | running | report
  const [report, setReport] = useState(null)
  const [animate, setAnimate] = useState(false)
  const [live, setLive] = useState(null)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(loadReports)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyMsg, setHistoryMsg] = useState('')
  const [presenting, setPresenting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [lastTarget, setLastTarget] = useState(null)
  const [weights, setWeights] = useState(() => ({ ...defaultWeights(), ...(loadWeights() || {}) }))
  const [pair, setPair] = useState(null)
  const [rerunning, setRerunning] = useState(null)
  const [rerunError, setRerunError] = useState(null)
  const runId = useRef(0)

  const show = useCallback((r, withReveal = true) => {
    setReport(r); setAnimate(withReveal); setRerunError(null); setLive(null); setError(null); setView('report'); window.scrollTo(0, 0)
  }, [])

  const apply = (ev) => setLive((cur) => {
    const l = cur || emptyLive()
    switch (ev.type) {
      case 'step': {
        const steps = l.steps.some((s) => s.id === ev.id) ? l.steps.map((s) => (s.id === ev.id ? { ...s, ...ev } : s)) : [...l.steps, { id: ev.id, status: ev.status, text: ev.text }]
        return { ...l, steps }
      }
      case 'meta': return { ...l, meta: ev.data }
      case 'versions': return { ...l, versions: ev.versions }
      case 'facts': return { ...l, facts: ev.facts }
      case 'category': {
        const r = ev.result
        const def = CATEGORIES.find((c) => c.id === r.category)
        const cat = r.error
          ? { id: def.id, name: def.name, tagline: def.tagline, applicable: true, error: r.error, wins: [], levelUps: [], score: null, grade: null, verdict: '' }
          : { id: def.id, name: def.name, tagline: def.tagline, applicable: r.applicable !== false, score: r.score, grade: r.grade, verdict: r.verdict, wins: r.wins, levelUps: r.levelUps, removed: r.removed }
        return { ...l, categories: [...l.categories.filter((c) => c.id !== cat.id), cat] }
      }
      default: return l
    }
  })

  const start = useCallback(async (url, team) => {
    const id = ++runId.current
    setPair(null); setError(null); setLastTarget(parseTarget(url)); setLive(emptyLive()); setView('running'); window.scrollTo(0, 0)
    try {
      const r = await runAnalysis({ url, team }, (ev) => { if (runId.current === id) apply(ev) })
      if (runId.current !== id) return
      setSaved(saveReport(r))
      show(r, true)
    } catch (err) {
      if (runId.current !== id) return
      setLive(null); setError({ message: err.message, hint: err.hint }); setView('home')
    }
  }, [show])

  const open = useCallback((r) => { setHistoryOpen(false); setPresenting(false); setPair(null); show(r, true) }, [show])
  const home = () => { runId.current += 1; setPair(null); setLive(null); setView('home'); setPresenting(false) }

  const copy = async () => {
    try { await navigator.clipboard.writeText(toMarkdown(shown)); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { download('report.md', toMarkdown(shown), 'text/markdown') }
  }
  const slug = (r) => `${r.repo.name}${r.pr ? `-pr${r.pr.number}` : ''}`
  const onImport = async (file) => {
    try {
      const reports = parseImport(await file.text())
      setSaved(importReports(reports))
      setHistoryMsg(`Imported ${reports.length} report${reports.length > 1 ? 's' : ''}.`)
    } catch (err) { setHistoryMsg(err.message) }
  }

  const changeWeights = (w) => { setWeights(w); saveWeights(w) }
  const resetWeights = () => { setWeights(defaultWeights()); saveWeights(null) }
  // the report as shown (teacher's weights applied); the saved one is never changed
  const shown = useMemo(() => withWeights(report, weights), [report, weights])
  const prev = useMemo(() => (report ? previousReport(report, saved) : null), [report, saved])
  const diff = useMemo(() => (prev ? diffReports(prev, report) : null), [prev, report])

  const rerun = async (categoryId) => {
    setRerunning(categoryId); setRerunError(null)
    try {
      const r = await rerunCategory(report, categoryId)
      const updated = replaceCategory(report, r)
      setSaved(saveReport(updated)); setReport(updated); setAnimate(false)
    } catch (err) { setRerunError({ message: err.message, hint: err.hint }) }
    finally { setRerunning(null) }
  }

  const last = error && lastTarget ? lastReportForRepo(lastTarget.owner, lastTarget.repo) : null
  useEffect(() => { document.body.classList.toggle('is-presenting', presenting) }, [presenting])

  return (
    <>
      <Header onHome={home} onHistory={() => { setHistoryMsg(''); setHistoryOpen(true) }} historyCount={saved.length} />
      {view === 'home' && <Home onSubmit={start} error={error} lastSaved={last} onOpenSaved={open} />}
      {view === 'running' && live && (
        <>
          <div className="running-wrap"><Progress title={live.meta ? `Checking ${live.meta.owner}/${live.meta.repo}${live.meta.pr ? ` · PR #${live.meta.pr.number}` : ''}` : 'Getting started…'} steps={live.steps} facts={live.facts} versions={live.versions} /></div>
          <ReportView report={null} live={live} />
        </>
      )}
      {view === 'report' && report && !pair && (
        <ReportView report={shown} animate={animate} copied={copied} weights={weights} onWeights={changeWeights} onResetWeights={resetWeights}
          diff={diff} prev={prev} onOpen={open} onRerun={rerun} rerunning={rerunning} rerunError={rerunError} onPresent={() => setPresenting(true)} onCopy={copy}
          onExport={() => download(`wagonmade-${slug(report)}.json`, exportJson([report]))} />
      )}
      {pair && <Compare a={pair[0]} b={pair[1]} weights={weights} onBack={() => setPair(null)} onOpen={open} />}
      {presenting && report && <Presentation report={shown} onExit={() => setPresenting(false)} />}
      {historyOpen && (
        <History reports={saved} message={historyMsg} onOpen={open} onCompare={(a, b) => { setHistoryOpen(false); setPair([a, b]); setView('report'); window.scrollTo(0, 0) }} onClose={() => setHistoryOpen(false)}
          onDelete={(k) => setSaved(deleteReport(k))} onImport={onImport}
          onExportAll={() => download(`wagonmade-reports-${new Date().toISOString().slice(0, 10)}.json`, exportJson(saved))} />
      )}
    </>
  )
}
