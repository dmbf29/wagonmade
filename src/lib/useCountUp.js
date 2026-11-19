import { useEffect, useState } from 'react'

// Counts from 0 up to `target`. Respects "reduce motion".
export function useCountUp(target, { duration = 1600, delay = 0, enabled = true } = {}) {
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const [value, setValue] = useState(enabled && !reduce ? 0 : target)
  useEffect(() => {
    if (!enabled || reduce || target == null) { setValue(target); return undefined }
    let raf
    let t0
    const timer = setTimeout(() => {
      const tick = (t) => {
        t0 ??= t
        const p = Math.min(1, (t - t0) / duration)
        setValue(Math.round(target * (1 - Math.pow(1 - p, 3))))
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, delay)
    return () => { clearTimeout(timer); cancelAnimationFrame(raf) }
  }, [target, duration, delay, enabled, reduce])
  return value
}
