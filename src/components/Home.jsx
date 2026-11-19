import React, { useState } from 'react'

const EXAMPLES = [
  ['A whole repo', 'https://github.com/owner/repo'],
  ['One pull request', 'https://github.com/owner/repo/pull/12'],
]

export default function Home({ onSubmit, error, lastSaved, onOpenSaved }) {
  const [url, setUrl] = useState('')
  const [team, setTeam] = useState('')
  const submit = (e) => {
    e.preventDefault()
    if (url.trim()) onSubmit(url.trim(), team.trim())
  }
  return (
    <main className="home">
      <h1 className="home-title">Let's see what <em>you</em> built.</h1>
      <p className="home-lede">Paste a GitHub repo or pull request. We'll look for what's working, and pick a few things to try next time.</p>
      <form className="home-form" onSubmit={submit}>
        <label className="sr-only" htmlFor="url">GitHub repository or pull request URL</label>
        <input id="url" className="input input-xl" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com/owner/repo" autoFocus spellCheck="false" autoComplete="off" />
        <div className="home-row">
          <label className="sr-only" htmlFor="team">Team name (optional)</label>
          <input id="team" className="input" value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Team name (optional)" />
          <button className="btn btn-primary btn-xl" type="submit" disabled={!url.trim()}>Check it</button>
        </div>
      </form>
      <p className="home-hint">{EXAMPLES.map(([label, ex]) => <span key={label}><strong>{label}:</strong> <code>{ex}</code></span>)}</p>
      {error && (
        <div className="notice" role="alert">
          <strong>{error.message}</strong>
          {error.hint && <p>{error.hint}</p>}
          {lastSaved && <button className="btn btn-primary" onClick={() => onOpenSaved(lastSaved)}>Open the last saved report for {lastSaved.repo.owner}/{lastSaved.repo.name}</button>}
        </div>
      )}
    </main>
  )
}
