import React, { useMemo } from 'react'
import { highlight } from '../lib/highlight.js'

export default function Code({ code, file, label }) {
  const html = useMemo(() => highlight(code, file), [code, file])
  return (
    <div className="code">
      {label && <div className="code-label">{label}</div>}
      <pre><code className="hljs" dangerouslySetInnerHTML={{ __html: html }} /></pre>
    </div>
  )
}
