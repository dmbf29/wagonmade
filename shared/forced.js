// Quick-check findings that ALWAYS become level-ups (the teacher's "flag these heavily" list).
// The AI used to be free to skip them; now they are built straight from the plain-code check,
// so the evidence is real by construction (file + lines + the real code), never a guess.
// Add a row to force another check. `impact` may be a number or a function of the count.

import { blobUrl } from '../api/_lib/verify.js'

// covers: how the AI words the SAME problem, so its duplicate is dropped when the forced one is shown
export const FORCED = [
  {
    check: 'tailwind-classes', covers: /tailwind|utility[- ]class/i, category: 'frontend', impact: 5,
    title: 'Tailwind-style classes in a Bootstrap app',
    concept: 'Rails assets: Bootstrap SCSS, color variables, asset pipeline',
    why: (n) => `${n} class lists look like Tailwind (utility classes such as flex, px-4, text-gray-600). This course stack is Bootstrap 5 plus your own SCSS, so these won't be styled the way you expect and make the app look like two different projects.`,
    mission: 'Next time, build the layout with Bootstrap classes and components you already know (d-flex, px-3, btn btn-primary, card).',
    example: '<div class="d-flex justify-content-between px-3">\n  <a class="btn btn-primary">Save</a>\n</div>',
  },
  {
    check: 'old-bootstrap', covers: /bootstrap ?[34]|pull-(left|right)|data-toggle|\b(ml|mr|pl|pr)-\d/i, category: 'frontend', impact: 4,
    title: 'Bootstrap 3/4 class names in a Bootstrap 5 app',
    concept: 'HTML, CSS & Bootstrap components',
    why: (n) => `${n} class names come from an older Bootstrap (for example pull-right, ml-2, data-toggle). Bootstrap 5 renamed them, so they silently do nothing.`,
    mission: 'Check the Bootstrap 5 docs for the new class name before you copy an old snippet (ms-2 instead of ml-2, data-bs-toggle).',
    example: '<div class="ms-2" data-bs-toggle="modal">',
  },
  {
    check: 'hex-in-scss', covers: /hex|hard-?coded colou?rs?|colou?r variables?|_colors/i, category: 'frontend', impact: (n) => (n >= 10 ? 4 : 3),
    title: 'Hard-coded hex colors instead of your color variables',
    concept: 'Rails assets: Bootstrap SCSS, color variables, asset pipeline',
    why: (n) => `${n} colors are typed as hex values in your stylesheets. You already keep a palette in config/_colors.scss: using the $variables keeps the whole app in one look and lets you re-theme it in one place.`,
    mission: 'Next time, add the color to config/_colors.scss once and use the $variable everywhere.',
    example: '// config/_colors.scss\n$brand: #0d9488;\n\n// components/_navbar.scss\n.navbar { background: $brand; }',
  },
  {
    check: 'hex-in-views', covers: /hex|hard-?coded colou?rs?|colou?rs? typed/i, category: 'frontend', impact: 3,
    title: 'Hex colors typed directly in views',
    concept: 'Rails assets: Bootstrap SCSS, color variables, asset pipeline',
    why: (n) => `${n} colors are typed straight into your HTML. Colors belong in your SCSS palette so every page stays consistent.`,
    mission: 'Next time, give the element a class and set its color with a $variable in your SCSS.',
    example: '.badge-tag { background: $brand; }',
  },
  {
    check: 'raw-llm-client', covers: /openai::client|ruby-?openai|raw (http|client)|direct(ly)?[^.]*(openai|ai provider)|instead of ruby_?llm/i, category: 'ai_assets', impact: 5,
    title: 'AI calls that skip ruby_llm',
    concept: 'Intro to LLMs: RubyLLM',
    why: (n) => `${n} place${n > 1 ? 's' : ''} talk to an AI provider directly (OpenAI::Client, an OpenAI/Anthropic gem or raw HTTP). In this course every AI call goes through RubyLLM, so keys, models and errors are handled in one way.`,
    mission: 'Next time, call the model with RubyLLM.chat(...).with_instructions(...).ask(...), exactly like the Intro to LLMs lecture.',
    example: 'chat = RubyLLM.chat(model: "gpt-4.1")\nchat.with_instructions(system_prompt)\nresponse = chat.ask(user_message)',
  },
  {
    check: 'unscoped-find', covers: /current_user|find\(params|someone else|other users?|scope[sd]? [^.]*(lookup|record|trip|find)/i, category: 'security', impact: 5,
    title: "Anyone signed in can open someone else's records",
    concept: 'Authentication with Devise',
    why: (n) => `${n} lookup${n > 1 ? 's find' : ' finds'} a record that belongs to a user with Model.find(params[:id]). Any signed-in user who guesses an id can open or change another user's data. Starting from current_user keeps it private.`,
    mission: 'Next time, always start from the signed-in user: current_user.things.find(params[:id]).',
    example: '@trip = current_user.trips.find(params[:id])',
  },
  {
    check: 'secret-files', covers: /secret|\.env|api key|master\.key|committed/i, category: 'security', impact: 5, secret: true,
    title: 'A secret file is committed to git',
    concept: 'Secrets with dotenv (.env)',
    why: () => 'A .env or key file is in your repository, so anyone who can see the repo can see your keys. Remove it from git and create a fresh key.',
    mission: 'Next time, put .env in .gitignore before the first commit, and create a new API key now.',
    example: '# .gitignore\n.env*',
  },
  {
    check: 'secret-strings', covers: /secret|\.env|api key|master\.key|committed/i, category: 'security', impact: 5, secret: true,
    title: 'A key-looking string is committed in the code',
    concept: 'Secrets with dotenv (.env)',
    why: () => 'Something that looks like an API key is written in a file. Keys belong in .env (read with ENV["KEY"]), never in committed code. Create a new key, the old one is now public.',
    mission: 'Next time, keep every key in .env and read it with ENV.fetch.',
    example: 'RubyLLM.configure { |c| c.openai_api_key = ENV["OPENAI_API_KEY"] }',
  },
]

// Real lines around a location, with the matching GitHub link. Secret hits never show the file text.
function evidenceFor(loc, files, repoRef, secret) {
  const file = files.find((f) => f.path === loc.path)
  if (!file || loc.whole || secret) {
    return { file: loc.path, startLine: secret ? loc.line : 0, endLine: secret ? loc.line : 0, snippet: loc.snippet, url: blobUrl(repoRef, loc.path, secret ? loc.line : 0) }
  }
  const lines = file.content.split('\n')
  const start = Math.max(1, loc.line)
  const end = Math.min(lines.length, start + 2)
  return { file: loc.path, startLine: start, endLine: end, snippet: lines.slice(start - 1, end).join('\n').replace(/\s+$/, ''), url: blobUrl(repoRef, loc.path, start, end) }
}

// Does this AI level-up repeat one of the forced ones of its category?
export function repeatsForced(categoryId, levelUp, forced) {
  const text = `${levelUp.title} ${levelUp.why} ${levelUp.mission}`
  return forced.some((f) => FORCED.some((r) => r.category === categoryId && r.title === f.title && r.covers.test(text)))
}

// Level-ups built from the checks that belong to this category
export function forcedLevelUps(categoryId, checks, files, repoRef) {
  const out = []
  for (const rule of FORCED.filter((r) => r.category === categoryId)) {
    const check = checks.checks.find((c) => c.id === rule.check)
    if (!check || !check.locations.length) continue
    const n = check.count ?? check.locations.length
    const loc = check.locations.find((l) => !l.whole) || check.locations[0]
    out.push({
      title: rule.title, why: rule.why(n), concept: rule.concept, mission: rule.mission, example: rule.example,
      confidence: 'high', impact: typeof rule.impact === 'function' ? rule.impact(n) : rule.impact,
      relocated: false, forced: true, evidence: evidenceFor(loc, files, repoRef, rule.secret),
    })
  }
  return out
}
