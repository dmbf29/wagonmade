import React, { useState } from 'react'

export default function Header({ onHome, onHistory, historyCount }) {
  const [logoOk, setLogoOk] = useState(true)
  return (
    <header className="topbar">
      <button className="brand" onClick={onHome} aria-label="Homemade, back to start">
        {/* Logo slot: drop the official file at /public/logo.svg */}
        {logoOk && <img className="brand-logo" src="/logo.svg" alt="Le Wagon" onError={() => setLogoOk(false)} />}
        <span className="brand-name">Homemade</span>
      </button>
      <button className="btn btn-ghost" onClick={onHistory}>
        History{historyCount ? <span className="pill">{historyCount}</span> : null}
      </button>
    </header>
  )
}
