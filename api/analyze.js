// POST /api/analyze   { category, files, versions, facts, mode, pr, git, tree, repo }
// Step 3 of a run: ONE AI call for ONE category. The browser fires several of
// these in parallel and shows each card as soon as its call finishes.

import { sendError } from './_lib/github.js'
import { analyzeCategory } from './_lib/analyze-core.js'

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' })
  try {
    res.status(200).json(await analyzeCategory(req.body || {}))
  } catch (err) {
    sendError(res, err)
  }
}
