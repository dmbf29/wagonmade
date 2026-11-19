// Tiny client-side parse so we can offer "last saved report" when a run fails.
export function parseTarget(input) {
  const m = String(input).match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/i)
  return m ? { owner: m[1], repo: m[2].replace(/\.git$/, '') } : null
}
