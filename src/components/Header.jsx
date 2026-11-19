import React from 'react'

export default function Header({ onHome, onHistory, historyCount }) {
  return (
    <header className="topbar">
      <button className="brand" onClick={onHome} aria-label="Wagonmade, back to start">
        <img className="brand-logo" src="/icon.png" alt="" />
        <span className="brand-name">Wagonmade</span>
      </button>
      <button className="btn btn-ghost" onClick={onHistory}>
        History{historyCount ? <span className="pill">{historyCount}</span> : null}
      </button>
    </header>
  )
}
