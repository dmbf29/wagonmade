// Score ceilings. The AI tends to give 82-92 to almost everything, so a serious finding
// must pull the score down whatever the AI said. Edit the numbers here to tune it.
//
//   high-confidence impact 5  -> at most 76 (a C)   e.g. any signed-in user can open any record
//   high-confidence impact 4  -> at most 84
//   medium-confidence impact 5 -> at most 82
//   medium-confidence impact 4 -> at most 88
//   two or more impact>=4 items -> 3 points lower again
// Low-confidence items ("worth a second look") never count.

export function scoreCeiling(levelUps = []) {
  let ceiling = 100
  let heavy = 0
  for (const l of levelUps) {
    if (!l || l.confidence === 'low') continue
    const high = l.confidence === 'high'
    if (l.impact >= 5) { ceiling = Math.min(ceiling, high ? 76 : 82); heavy += 1 }
    else if (l.impact === 4) { ceiling = Math.min(ceiling, high ? 84 : 88); heavy += 1 }
  }
  return heavy >= 2 ? ceiling - 3 : ceiling
}

export function capScore(score, levelUps) {
  const ceiling = scoreCeiling(levelUps)
  return score > ceiling ? { score: ceiling, capped: true, rawScore: score } : { score, capped: false }
}
