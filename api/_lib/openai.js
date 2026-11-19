// Thin OpenAI client: Chat Completions with Structured Outputs (JSON schema).
// Set MOCK_LLM=1 to skip the network (see analyze-core.js for the fake answer).

import { DEFAULT_OPENAI_MODEL } from '../../shared/config.js'
import { CONCEPTS } from '../../shared/curriculum.js'
import { HttpError } from './github.js'

export const modelName = () => process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL

const evidenceSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['file', 'start_line', 'end_line', 'snippet'],
  properties: {
    file: { type: 'string' },
    start_line: { type: 'integer' },
    end_line: { type: 'integer' },
    snippet: { type: 'string' },
  },
}

export const REPORT_SCHEMA = {
  name: 'category_report',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['applicable', 'score', 'verdict', 'wins', 'level_ups'],
    properties: {
      applicable: { type: 'boolean' },
      score: { type: 'integer' },
      verdict: { type: 'string' },
      wins: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'detail', 'evidence'],
          properties: { title: { type: 'string' }, detail: { type: 'string' }, evidence: evidenceSchema },
        },
      },
      level_ups: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'why', 'concept', 'confidence', 'impact', 'mission', 'example', 'evidence'],
          properties: {
            title: { type: 'string' },
            why: { type: 'string' },
            concept: { type: 'string', enum: CONCEPTS }, // closed list: no invented lectures
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            impact: { type: 'integer' },
            mission: { type: 'string' },
            example: { type: 'string' },
            evidence: evidenceSchema,
          },
        },
      },
    },
  },
}

// Split runs: parts only report findings; a small last call scores them (no code in it)
const without = (keys) => ({
  ...REPORT_SCHEMA.schema,
  required: REPORT_SCHEMA.schema.required.filter((k) => !keys.includes(k)),
  properties: Object.fromEntries(Object.entries(REPORT_SCHEMA.schema.properties).filter(([k]) => !keys.includes(k))),
})
export const FINDINGS_SCHEMA = { name: 'category_findings', strict: true, schema: without(['applicable', 'score', 'verdict']) }
export const SUMMARY_SCHEMA = { name: 'category_summary', strict: true, schema: without(['applicable', 'wins', 'level_ups']) }

async function callOnce(system, user, schema) {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new HttpError(500, 'OPENAI_API_KEY is not set on the server.', 'Add it in Vercel > Settings > Environment Variables (or in .env for local dev).')

  const body = {
    model: modelName(),
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    response_format: { type: 'json_schema', json_schema: schema },
    max_completion_tokens: 12000,
  }
  // Reasoning models (gpt-5*, o-series) think for a long time on big categories and hit the 60s limit.
  // Default to "low" for them; set OPENAI_REASONING_EFFORT (low | medium | high) to override.
  const effort = process.env.OPENAI_REASONING_EFFORT || (/^(gpt-5|o\d)/.test(body.model) ? 'low' : '')
  if (effort) body.reasoning_effort = effort

  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 52000)
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: ctl.signal,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg = data?.error?.message || `OpenAI answered ${res.status}`
      const retry = res.status === 429 || res.status >= 500
      const err = new HttpError(res.status === 401 ? 500 : 502, `The AI step failed: ${msg}`, res.status === 404 ? 'Check the OPENAI_MODEL name.' : undefined)
      err.retry = retry
      throw err
    }
    const choice = data.choices?.[0]
    if (choice?.message?.refusal) throw new HttpError(502, 'The AI declined to answer this one.')
    if (choice?.finish_reason === 'length') throw new HttpError(502, 'The AI ran out of room before finishing.', 'Try a lower OPENAI_REASONING_EFFORT.')
    try {
      return { json: JSON.parse(choice.message.content), usage: data.usage }
    } catch {
      throw new HttpError(502, 'The AI answered in a shape we could not read.')
    }
  } catch (err) {
    if (err.name === 'AbortError') throw new HttpError(504, 'The AI took too long on this category.', 'Re-run it, or set OPENAI_REASONING_EFFORT=low.')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export async function askModel(system, user, schema = REPORT_SCHEMA) {
  try {
    return await callOnce(system, user, schema)
  } catch (err) {
    if (!err.retry) throw err
    await new Promise((r) => setTimeout(r, 1500))
    return callOnce(system, user, schema)
  }
}
