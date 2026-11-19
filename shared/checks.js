// ─────────────────────────────────────────────────────────────────────────────
// Deterministic checks: plain JS, no AI, fast and repeatable.
// They run first and their results are handed to the AI as FACTS.
//
// Input : files  = [{ path, content, template?, changed? }]   (analysable files)
//         meta   = { paths: [every path in the repo], hygiene: {...}, mode }
// Output: { versions, gems, stats, checks: [...] }
//
// Each check = { id, categories, severity, title, ticker, count, locations[] }
//   severity: "issue" (worth a level-up) | "note" (minor, mention at most lightly)
//   locations: [{ path, line, snippet, whole? }]
// ─────────────────────────────────────────────────────────────────────────────

import { TRACKED_GEMS } from './config.js'

const MAX_LOCATIONS = 12

const trimSnippet = (s) => s.trim().replace(/\s+/g, ' ').slice(0, 160)

// ── tiny helpers ─────────────────────────────────────────────────────────────
function splitLines(content) {
  return content.split('\n')
}

function scan(files, pathRe, lineRe, { skipComments = false, filter } = {}) {
  const hits = []
  for (const f of files) {
    if (!pathRe.test(f.path)) continue
    const lines = splitLines(f.content)
    lines.forEach((line, i) => {
      if (skipComments && /^\s*(#|\/\/|<%#)/.test(line)) return
      const m = line.match(lineRe)
      if (m && (!filter || filter(line, m, f))) {
        hits.push({ path: f.path, line: i + 1, snippet: trimSnippet(line) })
      }
    })
  }
  return hits
}

// ── versions ─────────────────────────────────────────────────────────────────
export function detectVersions(files) {
  const lock = files.find((f) => f.path === 'Gemfile.lock')
  const versions = {}
  const gems = new Set()
  if (!lock) return { versions, gems }
  for (const line of lock.content.split('\n')) {
    const m = line.match(/^ {4}([A-Za-z0-9_.-]+) \(([^)]+)\)$/)
    if (m) {
      gems.add(m[1])
      if (TRACKED_GEMS.includes(m[1])) versions[m[1]] = m[2]
    }
  }
  return { versions, gems }
}

// ── Tailwind and old-Bootstrap class detection ──────────────────────────────
const TAILWIND_TOKEN = new RegExp(
  '^(?:(?:sm|md|lg|xl|2xl|hover|focus|dark|active|disabled|group-hover):)?(?:' +
    [
      'flex|grid|hidden|block|inline-block|inline-flex|inline-grid|relative|absolute|fixed|sticky',
      'flex-(?:col|row|wrap|1|auto|none|grow|shrink)',
      'items-(?:center|start|end|baseline|stretch)',
      'justify-(?:center|between|around|evenly|start|end)',
      'self-(?:center|start|end|stretch)',
      'space-[xy]-\\d+',
      'gap-(?:[6-9]|1\\d|2\\d)',
      'grid-cols-\\d+',
      'col-span-\\d+',
      'rounded-(?:sm|md|lg|xl|2xl|3xl|full|none)',
      'shadow-(?:md|xl|2xl|inner|none)',
      'text-(?:xs|sm|base|lg|xl|[2-9]xl)',
      '(?:text|bg|border|ring|from|to|via)-(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d{2,3}',
      'font-(?:thin|light|normal|medium|semibold|bold|extrabold|black)',
      '(?:w|h)-(?:full|screen|fit|min|max|\\d+/\\d+)',
      '(?:w|h)-(?!25$|50$|75$|100$|auto$)\\d+',
      'min-h-screen|min-w-full|max-w-(?:xs|sm|md|lg|xl|[2-7]xl|prose|full|screen-\\w+)',
      '-?(?:p|m|px|py|pt|pb|pl|pr|mx|my|mt|mb|ml|mr)-(?:[6-9]|1\\d|2\\d|\\d+\\.5)',
      '-(?:m|mx|my|mt|mb|ml|mr)-\\d+',
      'leading-(?:none|tight|snug|normal|relaxed|loose|\\d+)',
      'tracking-\\w+',
      'transition(?:-all|-colors|-opacity|-transform)?',
      'duration-\\d+|ease-(?:in|out|in-out|linear)',
      'z-(?:10|20|30|40|50)',
      'opacity-\\d+',
      'object-(?:cover|contain)',
      'overflow-(?:hidden|auto|scroll)-?[xy]?',
    ].join('|') +
    ')$',
)

const OLD_BOOTSTRAP_TOKEN = new RegExp(
  '^(?:' +
    [
      '(?:ml|mr|pl|pr)-(?:\\d|auto)',
      'float-(?:left|right)',
      'text-(?:left|right)',
      'font-weight-\\w+',
      'font-italic',
      'badge-(?:primary|secondary|success|danger|warning|info|light|dark|pill)',
      'form-group|form-row|form-inline',
      'custom-(?:select|control|file|range|checkbox|radio|switch|control-input|control-label)',
      'input-group-(?:append|prepend)',
      'btn-block',
      'sr-only',
      'no-gutters',
      'card-deck',
      'jumbotron',
      'embed-responsive(?:-\\w+)?',
      'rounded-(?:left|right)',
      'border-(?:left|right)-0',
      // Bootstrap 3
      'panel(?:-\\w+)?|glyphicon(?:-\\w+)?|col-xs-\\d+|navbar-(?:default|toggle|fixed-top-xx)|pull-(?:left|right)|hidden-(?:xs|sm|md|lg)|btn-default|label-(?:default|primary|success|info|warning|danger)|well',
    ].join('|') +
    ')$',
)

// Pull class strings out of ERB / HTML / JS / helpers
function classStrings(line) {
  const out = []
  const re = /class(?:es)?\s*(?:=|:|=>)\s*(?:"([^"]*)"|'([^']*)')/g
  let m
  while ((m = re.exec(line))) {
    const raw = (m[1] ?? m[2] ?? '').replace(/<%.*?%>/g, ' ').replace(/#\{[^}]*\}/g, ' ')
    out.push(raw)
  }
  return out
}

function classHits(files, tokenRe, pathRe = /^app\/(views|helpers|javascript)\//) {
  const hits = []
  for (const f of files) {
    if (!pathRe.test(f.path)) continue
    splitLines(f.content).forEach((line, i) => {
      for (const str of classStrings(line)) {
        const bad = str.split(/\s+/).filter((t) => t && tokenRe.test(t))
        if (bad.length) {
          hits.push({ path: f.path, line: i + 1, snippet: trimSnippet(line), tokens: bad.slice(0, 6) })
          break
        }
      }
    })
  }
  return hits
}

// ── routes parsing (very small block tracker) ───────────────────────────────
function analyseRoutes(routesFile) {
  const result = { custom: [], member: [], resources: 0, resourcesWithOnly: 0, nested: 0, root: false }
  if (!routesFile) return result
  const stack = []
  splitLines(routesFile.content).forEach((raw, i) => {
    const line = raw.replace(/#.*$/, '').trim()
    if (!line) return
    const opener = line.match(/^(resources?|namespace|scope|member|collection|devise_scope|authenticated|authenticate|constraints|concern)\b.*\bdo(\s*\|[^|]*\|)?$/)
    if (/^root\b/.test(line)) result.root = true
    if (/^resources?\b/.test(line)) {
      result.resources += 1
      if (/\b(only|except):/.test(line)) result.resourcesWithOnly += 1
      if (stack.some((s) => s === 'resources' || s === 'resource')) result.nested += 1
    }
    const verb = line.match(/^(get|post|patch|put|delete|match)\s+(['"])([^'"]*)\2/) || line.match(/^(get|post|patch|put|delete|match)\s+(['"])?([\w/:-]+)/)
    if (verb && !/^(devise_for)/.test(line)) {
      const target = verb[3]
      const loc = { path: routesFile.path, line: i + 1, snippet: trimSnippet(raw) }
      const inMember = stack.includes('member') || stack.includes('collection')
      const isInfra = /^(up|service-worker|manifest)$/.test(target) || /rails\/health|pwa#/.test(line)
      if (!isInfra) (inMember ? result.member : result.custom).push(loc)
    }
    if (opener) stack.push(opener[1])
    else if (/\bdo(\s*\|[^|]*\|)?$/.test(line)) stack.push('block')
    if (line === 'end') stack.pop()
  })
  return result
}

// ── controllers parsing ─────────────────────────────────────────────────────
const REST = ['index', 'show', 'new', 'create', 'edit', 'update', 'destroy']

function analyseController(f) {
  const lines = splitLines(f.content)
  const actions = []
  let publicZone = true
  lines.forEach((line, i) => {
    if (/^\s{2}(private|protected)\s*$/.test(line)) publicZone = false
    const m = line.match(/^(\s*)def ([a-z_]+[?!]?)/)
    if (m && m[1].length === 2) {
      const indent = m[1]
      let end = i
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].startsWith(indent + 'end') && /^\s*end\s*$/.test(lines[j]) && lines[j].search(/\S/) === indent.length) {
          end = j
          break
        }
      }
      actions.push({ name: m[2], line: i + 1, length: end - i - 1, isPublic: publicZone })
    }
  })
  return actions
}

// ── view → controller wiring ────────────────────────────────────────────────
function stimulusNameFor(path) {
  const m = path.match(/^app\/javascript\/controllers\/(.+)_controller\.js$/)
  return m ? m[1].replace(/_/g, '-').replace(/\//g, '--') : null
}

function usedStimulusNames(files) {
  const used = new Set()
  for (const f of files) {
    if (!/^app\/(views|helpers)\//.test(f.path) && !/\.erb$/.test(f.path)) continue
    for (const m of f.content.matchAll(/data-controller\s*=\s*["']([^"']+)["']/g)) m[1].split(/\s+/).forEach((n) => used.add(n))
    for (const m of f.content.matchAll(/controller:\s*["']([^"']+)["']/g)) m[1].split(/\s+/).forEach((n) => used.add(n))
    for (const m of f.content.matchAll(/["']controller["']\s*=>\s*["']([^"']+)["']/g)) m[1].split(/\s+/).forEach((n) => used.add(n))
  }
  return used
}

// ─────────────────────────────────────────────────────────────────────────────
export function runChecks(allFiles, meta = {}) {
  // Template boilerplate is never analysed
  const files = allFiles.filter((f) => !f.template)
  const paths = meta.paths || allFiles.map((f) => f.path)
  const hygiene = meta.hygiene || { secretHits: [] }
  const checks = []
  const add = (c) => {
    if (c.count === undefined) c.count = c.locations ? c.locations.length : 0
    if (!c.count) return
    c.locations = (c.locations || []).slice(0, MAX_LOCATIONS)
    checks.push(c)
  }

  const { versions, gems } = detectVersions(allFiles)
  const byPath = Object.fromEntries(files.map((f) => [f.path, f]))
  const views = files.filter((f) => /^app\/views\//.test(f.path))
  const scss = files.filter((f) => /^app\/assets\/stylesheets\/.*\.(scss|css|sass)$/.test(f.path))
  const controllers = files.filter((f) => /^app\/controllers\/.+_controller\.rb$/.test(f.path))
  const models = files.filter((f) => /^app\/models\/.+\.rb$/.test(f.path) && !/application_record/.test(f.path))
  const jsFiles = files.filter((f) => /^app\/javascript\/.*\.js$/.test(f.path))
  const stimulusFiles = jsFiles.filter((f) => /^app\/javascript\/controllers\/.+_controller\.js$/.test(f.path))
  const appCode = files.filter((f) => /^app\/.*\.(rb|erb|js)$/.test(f.path))

  // ── FRONT-END ──────────────────────────────────────────────────────────────
  const tw = classHits(files, TAILWIND_TOKEN)
  add({
    id: 'tailwind-classes', categories: ['frontend'], severity: 'issue',
    title: 'Tailwind-style classes (this app uses Bootstrap 5)',
    ticker: (n) => `Found ${n} Tailwind-looking class lists…`,
    locations: tw, count: tw.length,
    detail: tw.slice(0, 5).map((h) => h.tokens.join(' ')).join(' | '),
  })

  const oldBs = classHits(files, OLD_BOOTSTRAP_TOKEN)
  const oldBsAttrs = scan(views, /./, /\bdata-(toggle|target|dismiss|ride|slide|parent|spy|placement|trigger)\s*=/)
  const oldBsAll = [...oldBs, ...oldBsAttrs]
  add({
    id: 'old-bootstrap', categories: ['frontend', 'javascript'], severity: 'issue',
    title: 'Bootstrap 3/4 classes or attributes (this app uses Bootstrap 5)',
    ticker: (n) => `Spotted ${n} Bootstrap 4-style classes or attributes…`,
    locations: oldBsAll, count: oldBsAll.length,
    detail: oldBs.slice(0, 5).map((h) => h.tokens.join(' ')).join(' | '),
  })

  const inline = scan(views, /\.erb$/, /\sstyle\s*=\s*["']/)
  const kitBackground = (h) => /style\s*=\s*["']background-image/.test(h.snippet) && /(banner|card-category|card-product|avatar)/.test(h.snippet)
  const inlineAll = inline.filter((h) => !kitBackground(h))
  const inlineStatic = inlineAll.filter((h) => !/<%/.test(h.snippet))
  add({
    id: 'inline-styles', categories: ['frontend'], severity: inlineStatic.length >= 3 ? 'issue' : 'note',
    title: `Inline style="…" attributes (${inlineStatic.length} static, ${inlineAll.length - inlineStatic.length} dynamic)`,
    ticker: (n) => `${n} inline styles in your views…`,
    locations: inlineStatic.length ? inlineStatic : inlineAll, count: inlineAll.length,
  })

  const styleTags = scan(views, /\.erb$/, /<style[\s>]/i)
  add({
    id: 'style-tags', categories: ['frontend'], severity: 'issue',
    title: '<style> tags inside views', ticker: (n) => `${n} <style> tags in views…`, locations: styleTags,
  })

  const viewHex = scan(views, /\.erb$/, /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![\w-])/, { filter: (l) => /style|color|background|fill|stroke/i.test(l) })
  add({
    id: 'hex-in-views', categories: ['frontend'], severity: 'issue',
    title: 'Hex colors typed directly in views', ticker: (n) => `${n} hex colors typed in views…`, locations: viewHex,
  })

  const stripScssComments = (f) => ({ ...f, content: f.content.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/\/\/.*$/gm, '') })
  const scssNoComments = scss.map(stripScssComments)
  const hexScss = scan(scssNoComments, /^app\/assets\/stylesheets\/(?!config\/_colors\.scss$)(?!.*(rouge|pygments|highlight|syntax))/i, /#[0-9a-fA-F]{3,8}\b/, {
    filter: (line) => !/^\s*@import|url\(/.test(line) && /[:,(]\s*#[0-9a-fA-F]{3,8}\b/.test(line),
  })
  add({
    id: 'hex-in-scss', categories: ['frontend'], severity: 'issue',
    title: 'Hex colors in SCSS outside config/_colors.scss (use the $color variables)',
    ticker: (n) => `${n} hard-coded hex colors outside _colors.scss…`, locations: hexScss,
  })

  const important = scan(scssNoComments, /./, /!important/)
  add({
    id: 'important', categories: ['frontend'], severity: important.length >= 4 ? 'issue' : 'note',
    title: '!important in SCSS', ticker: (n) => `${n} uses of !important…`, locations: important,
  })

  const cssFiles = paths.filter((p) => /^app\/assets\/stylesheets\/.+\.css$/.test(p))
  add({
    id: 'css-files', categories: ['frontend'], severity: 'issue',
    title: '.css files in app/assets/stylesheets (this app uses SCSS partials)',
    ticker: (n) => `${n} plain .css files…`,
    locations: cssFiles.map((p) => ({ path: p, line: 1, snippet: p, whole: true })),
  })

  // component / page partials not imported
  const unimported = []
  for (const dir of ['components', 'pages']) {
    const indexFile = byPath[`app/assets/stylesheets/${dir}/_index.scss`] || allFiles.find((f) => f.path === `app/assets/stylesheets/${dir}/_index.scss`)
    const imports = indexFile ? [...indexFile.content.matchAll(/@(?:import|use|forward)\s+["']([^"']+)["']/g)].map((m) => m[1].replace(/^.*\//, '').replace(/^_/, '').replace(/\.scss$/, '')) : null
    if (!imports) continue
    for (const p of paths) {
      const m = p.match(new RegExp(`^app/assets/stylesheets/${dir}/_(.+)\\.scss$`))
      if (m && m[1] !== 'index' && !imports.includes(m[1])) unimported.push({ path: p, line: 1, snippet: `${p} is not imported in ${dir}/_index.scss`, whole: true })
    }
  }
  add({
    id: 'unimported-partials', categories: ['frontend', 'wagonmade'], severity: 'issue',
    title: 'SCSS partials that are not imported in their _index.scss (so they have no effect)',
    ticker: (n) => `${n} SCSS files never imported…`, locations: unimported,
  })

  const fontFamilies = scan(scssNoComments, /^app\/assets\/stylesheets\/(?!config\/_fonts\.scss$|config\/_bootstrap_variables\.scss$)(?!.*(rouge|pygments|highlight|syntax))/i, /font-family\s*:/, {
    filter: (l) => !/\$[\w-]*font/.test(l) && !/inherit|monospace\s*;?$/.test(l),
  })
  const fontLinks = [
    ...scan(views, /\.erb$/, /fonts\.googleapis\.com/),
    ...scan(scssNoComments, /^app\/assets\/stylesheets\/(?!config\/_fonts\.scss$)/, /fonts\.googleapis\.com/),
  ]
  add({
    id: 'fonts-outside', categories: ['frontend'], severity: 'issue',
    title: 'Fonts defined outside config/_fonts.scss', ticker: (n) => `${n} fonts set outside _fonts.scss…`, locations: [...fontFamilies, ...fontLinks],
  })

  const faCdn = scan(views, /\.erb$/, /(fontawesome|font-awesome)[^"']*\.(js|css)|kit\.fontawesome\.com|use\.fontawesome\.com/i)
  add({
    id: 'fa-cdn', categories: ['frontend'], severity: 'issue',
    title: 'Font Awesome loaded from a CDN (the font-awesome-sass gem is installed)',
    ticker: (n) => `Font Awesome loaded from a CDN ${n}×…`, locations: faCdn,
  })
  const faOld = scan(files, /^app\/(views|helpers)\//, /class\s*[=:]\s*["'][^"']*\bfa\s+fa-/)
  add({
    id: 'fa-old-syntax', categories: ['frontend'], severity: 'note',
    title: 'Old Font Awesome 4 syntax ("fa fa-…" instead of "fa-solid fa-…")', ticker: (n) => `${n} old-style Font Awesome icons…`, locations: faOld,
  })

  const formWith = scan(views, /\.erb$/, /<%=?\s*(form_with|form_tag|form_for)\b/)
  const simpleForm = scan(views, /\.erb$/, /<%=?\s*simple_form_for\b/)
  add({
    id: 'form-with', categories: ['frontend', 'rails'], severity: 'issue',
    title: `form_with / form_tag instead of simple_form_for (${formWith.length} vs ${simpleForm.length} simple_form_for)`,
    ticker: (n) => `${n} forms not using simple_form…`, locations: formWith,
  })

  const comps = ['banner', 'card-category', 'card-product', 'avatar', 'cards', 'navbar']
  const usedComps = comps.filter((c) => views.some((v) => new RegExp(`class\\s*[=:]\\s*["'][^"']*\\b${c}\\b`).test(v.content)))

  // ── JAVASCRIPT / HOTWIRE ───────────────────────────────────────────────────
  const scriptTags = scan(views, /\.erb$/, /<script\b/i, { filter: (l) => !/type\s*=\s*["']importmap/.test(l) })
  add({
    id: 'script-tags', categories: ['javascript'], severity: 'issue',
    title: '<script> tags inside views (use a Stimulus controller)', ticker: (n) => `${n} <script> tags in views…`, locations: scriptTags,
  })
  const inlineHandlers = scan(views, /\.erb$/, /\son(click|change|submit|input|keyup|load)\s*=\s*["']/i)
  add({
    id: 'inline-handlers', categories: ['javascript'], severity: 'issue',
    title: 'Inline onclick=/onchange= handlers (use data-action)', ticker: (n) => `${n} inline JS event handlers…`, locations: inlineHandlers,
  })
  const nonStimulusJs = jsFiles.filter((f) => !/^app\/javascript\/controllers\//.test(f.path))
  const domReady = scan(nonStimulusJs, /./, /DOMContentLoaded|turbo:load|turbolinks:load|\$\(document\)\.ready/, { skipComments: true })
  add({
    id: 'dom-ready', categories: ['javascript'], severity: 'issue',
    title: 'DOMContentLoaded / page-load handlers (Stimulus connect() replaces these)', ticker: (n) => `${n} page-load handlers outside Stimulus…`, locations: domReady,
  })
  const domQueries = scan(nonStimulusJs, /./, /document\.(querySelector|getElementById|querySelectorAll|getElementsBy)/, { skipComments: true })
  add({
    id: 'dom-queries', categories: ['javascript'], severity: 'issue',
    title: 'DOM querying logic outside a Stimulus controller', ticker: (n) => `${n} document.querySelector calls outside Stimulus…`, locations: domQueries,
  })
  const jq = [
    ...scan(jsFiles, /./, /\bjQuery\b|\$\(["'`#.]|import\s+\$|from\s+["']jquery/, { skipComments: true }),
    ...scan(views, /\.erb$/, /\$\(["'`#.]|jQuery/),
  ]
  add({
    id: 'jquery', categories: ['javascript'], severity: 'issue',
    title: 'jQuery usage (this app uses Stimulus)', ticker: (n) => `${n} jQuery calls…`, locations: jq,
  })
  const turbolinks = [
    ...scan(jsFiles, /./, /turbolinks/i, { skipComments: true }),
    ...scan(views, /\.erb$/, /turbolinks|data-turbolinks/i),
  ]
  add({
    id: 'turbolinks', categories: ['javascript'], severity: 'issue',
    title: 'Turbolinks (replaced by Turbo)', ticker: (n) => `${n} Turbolinks references…`, locations: turbolinks,
  })
  const cdnImports = [
    ...scan(jsFiles, /./, /(?:import\b[^;]*from\s*|import\s*\()\s*["']https?:\/\//),
    ...scan(views, /\.erb$/, /<script[^>]+src\s*=\s*["']https?:\/\//i),
  ]
  add({
    id: 'cdn-imports', categories: ['javascript'], severity: 'issue',
    title: 'JavaScript pulled from a CDN instead of importmap', ticker: (n) => `${n} CDN script imports…`, locations: cdnImports,
  })
  const npmFiles = paths.filter((p) => /^(package\.json|yarn\.lock|package-lock\.json|webpack\.config\.js|esbuild\.config\.js)$/.test(p))
  add({
    id: 'npm-files', categories: ['javascript'], severity: 'note',
    title: 'npm/yarn/bundler files (the template uses importmap, no npm)', ticker: (n) => `${n} npm files found…`,
    locations: npmFiles.map((p) => ({ path: p, line: 1, snippet: p, whole: true })),
  })

  // unpinned bare imports
  const importmap = allFiles.find((f) => f.path === 'config/importmap.rb')
  if (importmap) {
    const pinned = new Set([...importmap.content.matchAll(/^\s*pin\s+["']([^"']+)["']/gm)].map((m) => m[1]))
    const pinAll = [...importmap.content.matchAll(/pin_all_from\s+["']([^"']+)["']\s*,\s*under:\s*["']([^"']+)["']/g)].map((m) => m[2])
    const unpinned = []
    for (const f of jsFiles) {
      splitLines(f.content).forEach((line, i) => {
        const m = line.match(/^\s*import\b[^'"]*["']([^"'./][^"']*)["']/)
        if (!m) return
        const spec = m[1]
        const ok = pinned.has(spec) || pinAll.some((u) => spec === u || spec.startsWith(u + '/')) || [...pinned].some((p) => spec.startsWith(p + '/'))
        if (!ok) unpinned.push({ path: f.path, line: i + 1, snippet: trimSnippet(line) })
      })
    }
    add({
      id: 'unpinned-imports', categories: ['javascript'], severity: 'issue',
      title: 'JavaScript imports that are not pinned in config/importmap.rb', ticker: (n) => `${n} imports missing from importmap…`, locations: unpinned,
    })
  }

  const stimulusNames = stimulusFiles.map((f) => ({ f, name: stimulusNameFor(f.path) })).filter((x) => x.name && x.name !== 'hello')
  const used = usedStimulusNames(allFiles)
  const unusedStimulus = stimulusNames.filter((x) => !used.has(x.name)).map((x) => ({ path: x.f.path, line: 1, snippet: `${x.name} is never used with data-controller`, whole: true }))
  add({
    id: 'unused-stimulus', categories: ['javascript', 'wagonmade'], severity: 'note',
    title: 'Stimulus controllers never connected to a view', ticker: (n) => `${n} Stimulus controllers not used in any view…`, locations: unusedStimulus,
  })
  const consoleLogs = scan(jsFiles, /./, /\bconsole\.(log|debug)\(/, { skipComments: true })
  add({
    id: 'console-log', categories: ['wagonmade'], severity: 'note',
    title: 'Leftover console.log', ticker: (n) => `${n} console.log calls…`, locations: consoleLogs,
  })

  const deleteLinks = scan(views, /\.erb$/, /link_to[^\n]*(?<![A-Za-z_])method:\s*:(delete|patch|put|post)|data-method\s*=|data:\s*\{[^}]*(?<![A-Za-z_])method:/)
  add({
    id: 'link-to-method', categories: ['javascript', 'rails'], severity: 'issue',
    title: 'link_to … method: :delete (needs Rails UJS; use button_to or data-turbo-method)', ticker: (n) => `${n} link_to with method:…`, locations: deleteLinks,
  })

  // ── RAILS WAY ──────────────────────────────────────────────────────────────
  const routes = analyseRoutes(allFiles.find((f) => f.path === 'config/routes.rb'))
  add({
    id: 'custom-routes', categories: ['rails'], severity: routes.custom.length >= 3 ? 'issue' : 'note',
    title: `Custom get/post routes outside resources (${routes.resources} resources lines in routes.rb)`,
    ticker: (n) => `Found ${n} custom routes…`, locations: routes.custom,
  })
  add({
    id: 'member-routes', categories: ['rails'], severity: 'note',
    title: 'Extra member/collection routes', ticker: (n) => `${n} member/collection routes…`, locations: routes.member,
  })

  const nonRest = []
  const longActions = []
  for (const c of controllers) {
    if (/\/(pages|home|static)_controller\.rb$/.test(c.path) || /application_controller|devise|users\/(registrations|sessions|omniauth)/.test(c.path)) continue
    for (const a of analyseController(c)) {
      if (a.isPublic && !REST.includes(a.name) && !['initialize'].includes(a.name)) {
        nonRest.push({ path: c.path, line: a.line, snippet: `def ${a.name}` })
      }
      if (a.isPublic && a.length > 15) longActions.push({ path: c.path, line: a.line, snippet: `def ${a.name} (${a.length} lines)` })
    }
  }
  add({
    id: 'non-restful-actions', categories: ['rails'], severity: 'issue',
    title: 'Public controller actions outside the 7 RESTful ones', ticker: (n) => `${n} non-RESTful controller actions…`, locations: nonRest,
  })
  add({
    id: 'long-actions', categories: ['rails'], severity: 'issue',
    title: 'Long controller actions (over 15 lines)', ticker: (n) => `${n} long controller actions…`, locations: longActions,
  })

  const permitBang = scan(controllers, /./, /params\.permit!|\.permit!/, { skipComments: true })
  add({
    id: 'permit-bang', categories: ['rails', 'security'], severity: 'issue',
    title: 'params.permit! lets every parameter through', ticker: (n) => `${n} params.permit! calls…`, locations: permitBang,
  })
  const rawParams = scan(controllers, /./, /\.(new|create|update|update_attributes|assign_attributes)\(\s*params(\[|\.require\([^)]*\)\s*\))/, { skipComments: true })
  const missingStrong = []
  add({
    id: 'no-strong-params', categories: ['rails', 'security'], severity: 'issue',
    title: 'Mass-assigning params without strong params', ticker: (n) => `${n} places without strong params…`, locations: [...rawParams, ...missingStrong],
  })
  const noStatus = controllers
    .filter((c) => /\bdef (create|update)\b/.test(c.content) && /\brender\s*:?(new|edit)/.test(c.content) && !/unprocessable/.test(c.content))
    .map((c) => ({ path: c.path, line: 1, snippet: 'render :new/:edit without status: :unprocessable_entity', whole: true }))
  add({
    id: 'missing-422', categories: ['rails'], severity: 'note',
    title: 'render :new / :edit without status: :unprocessable_entity (Turbo needs it)', ticker: (n) => `${n} renders without 422 status…`, locations: noStatus,
  })
  const viewQueries = scan(views, /\.erb$/, /<%[=-]?[^%]*\b[A-Z][a-zA-Z]+\.(where|find|find_by|all|order|count|first|last|joins|includes)\b/)
  add({
    id: 'queries-in-views', categories: ['rails'], severity: 'issue',
    title: 'Database queries written inside views', ticker: (n) => `${n} database queries inside views…`, locations: viewQueries,
  })

  const modelStats = models.filter((m) => !/\bdevise\b/.test(m.content)).map((m) => ({
    path: m.path,
    assoc: (m.content.match(/^\s*(belongs_to|has_many|has_one|has_and_belongs_to_many)\b/gm) || []).length,
    validations: (m.content.match(/^\s*validates?\b/gm) || []).length,
  }))
  const noValidations = modelStats.filter((m) => m.validations === 0 && m.assoc >= 0).map((m) => ({ path: m.path, line: 1, snippet: `${m.path} has no validations`, whole: true }))
  add({
    id: 'models-without-validations', categories: ['rails'], severity: 'note',
    title: 'Models without any validation', ticker: (n) => `${n} models without validations…`, locations: noValidations,
  })

  const appCtrl = allFiles.find((f) => f.path === 'app/controllers/application_controller.rb')
  const devise = gems.has('devise')
  const authInApp = !!appCtrl && /before_action\s+:authenticate_user!/.test(appCtrl.content)
  const skipsAuth = scan(controllers, /./, /skip_before_action\s+:authenticate_user!/, { skipComments: true })
  const authSomewhere = controllers.some((c) => /authenticate_user!/.test(c.content))
  add({
    id: 'no-auth', categories: ['rails', 'security'], severity: 'issue',
    title: 'Devise is installed but nothing calls authenticate_user!',
    ticker: () => 'Devise installed but no authenticate_user! found…',
    locations: devise && !authSomewhere ? [{ path: 'app/controllers/application_controller.rb', line: 1, snippet: 'no before_action :authenticate_user! anywhere', whole: true }] : [],
  })
  const skipsWithoutOnly = skipsAuth.filter((h) => !/\bonly:/.test(h.snippet) && !/pages_controller/.test(h.path))
  add({
    id: 'skip-auth-all', categories: ['security'], severity: 'issue',
    title: 'Whole controllers that skip authentication', ticker: (n) => `${n} controllers skipping login…`, locations: skipsWithoutOnly,
  })

  // ── AI & ASSETS ────────────────────────────────────────────────────────────
  const rawOpenAI = [
    ...scan(files, /^(app|config|lib)\/.*\.rb$/, /OpenAI::Client|OpenAI\.configure|ruby-openai|ruby_openai|\bOpenAI::/, { skipComments: true }),
    ...scan(files, /^(app|config|lib)\/.*\.rb$/, /(Net::HTTP|Faraday|HTTParty|RestClient)[^\n]*|api\.(openai|anthropic)\.com|generativelanguage\.googleapis\.com/, { skipComments: true, filter: (l) => /openai|anthropic|googleapis|completions|gemini/i.test(l) }),
  ]
  const hasOpenAIGem = ['ruby-openai', 'openai', 'ruby_openai', 'anthropic'].some((g) => gems.has(g))
  if (hasOpenAIGem) rawOpenAI.push({ path: 'Gemfile.lock', line: 1, snippet: `Gemfile.lock includes ${['ruby-openai', 'openai', 'ruby_openai', 'anthropic'].filter((g) => gems.has(g)).join(', ')}`, whole: true })
  add({
    id: 'raw-llm-client', categories: ['ai'], severity: 'issue',
    title: 'Talking to an AI provider without ruby_llm (ruby-openai / OpenAI::Client / raw HTTP)', ticker: (n) => `${n} AI calls not going through ruby_llm…`, locations: rawOpenAI,
  })

  const usesRubyLLM = scan(files, /^(app|config|lib)\/.*\.rb$/, /RubyLLM\b/).length
  const attachments = scan(files, /^app\/models\//, /\bhas_(one|many)_attached\b/)
  const fileFields = scan(views, /\.erb$/, /\b(file_field|f\.file_field|as: :file|f\.input\s+:\w+,\s*as:\s*:file)/)
  const storageYml = allFiles.find((f) => f.path === 'config/storage.yml')
  const cloudinaryInStorage = !!storageYml && /service:\s*Cloudinary/i.test(storageYml.content)
  const envFiles = allFiles.filter((f) => /^config\/environments\//.test(f.path))
  const serviceSetToCloud = envFiles.some((f) => /active_storage\.service\s*=\s*:cloudinary/.test(f.content))
  if (attachments.length || fileFields.length) {
    add({
      id: 'uploads-not-cloudinary', categories: ['ai', 'security'], severity: 'issue',
      title: 'Uploads are declared but Cloudinary is not wired in storage.yml / environments',
      ticker: () => 'Uploads found but Cloudinary not configured…',
      locations: !cloudinaryInStorage || !serviceSetToCloud
        ? [{ path: 'config/storage.yml', line: 1, snippet: `storage.yml cloudinary service: ${cloudinaryInStorage ? 'yes' : 'no'}; environments set it: ${serviceSetToCloud ? 'yes' : 'no'}`, whole: true }]
        : [],
    })
  }
  const fileFieldNoAttach = fileFields.length && !attachments.length
  add({
    id: 'file-field-without-attachment', categories: ['ai'], severity: 'note',
    title: 'A file field exists but no model has has_one_attached / has_many_attached', ticker: () => 'file_field without Active Storage…',
    locations: fileFieldNoAttach ? fileFields : [],
  })

  // ── SECURITY & HYGIENE ─────────────────────────────────────────────────────
  // Model.find(params[:id]) on a model that belongs to a user: any signed-in user can open someone else's record
  const userOwned = models.filter((m) => /^\s*belongs_to\s+:user\b/m.test(m.content)).map((m) => m.path.match(/([^/]+)\.rb$/)[1].split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(''))
  const unscopedFind = userOwned.length && devise
    ? scan(files, /^app\/controllers\/.+_controller\.rb$/, new RegExp(`\\b(${userOwned.join('|')})\\.(find|find_by!?|find_by_id)\\(\\s*(params|id:)`), { skipComments: true })
    : []
  add({
    id: 'unscoped-find', categories: ['security'], severity: 'issue',
    title: 'Records that belong to a user are found with Model.find(params[...]) instead of current_user.things.find(...): any signed-in user could open or change them',
    ticker: (n) => `${n} records looked up without current_user scoping…`, locations: unscopedFind,
  })
  const committedEnv = paths.filter((p) => /^(\.env(\..+)?|config\/master\.key|config\/credentials\/.+\.key)$/.test(p) && !/\.(example|sample|template)$/.test(p))
  add({
    id: 'secret-files', categories: ['security', 'ai'], severity: 'issue',
    title: '.env or master.key committed to git', ticker: (n) => `${n} secret files committed…`,
    locations: committedEnv.map((p) => ({ path: p, line: 1, snippet: p, whole: true })),
  })
  add({
    id: 'secret-strings', categories: ['security', 'ai'], severity: 'issue',
    title: 'API-key-looking strings committed (values redacted)', ticker: (n) => `${n} key-looking strings committed…`,
    locations: (hygiene.secretHits || []).map((h) => ({ path: h.path, line: h.line, snippet: `${h.kind} (redacted)` })),
  })
  const gitignore = allFiles.find((f) => f.path === '.gitignore')
  if (gitignore && !/^\/?\.env/m.test(gitignore.content)) {
    add({
      id: 'gitignore-env', categories: ['security', 'ai'], severity: 'issue',
      title: '.gitignore does not ignore .env files', ticker: () => '.gitignore is missing .env…',
      locations: [{ path: '.gitignore', line: 1, snippet: 'no ".env*" line in .gitignore', whole: true }],
    })
  }
  const dotenvGem = gems.has('dotenv-rails') || gems.has('dotenv')

  const debugLeft = [
    ...scan(files, /^app\/.*\.(rb|erb)$/, /\b(binding\.(irb|pry)|byebug|debugger)\b|^\s*(puts|pp)\s|<%=?\s*(puts|pp|debug)\b/, { skipComments: true }),
    ...scan(files, /^app\/.*\.rb$/, /^\s*p\s+[\w@"':]/, { skipComments: true }),
  ]
  add({
    id: 'debug-leftovers', categories: ['wagonmade', 'security'], severity: 'note',
    title: 'Leftover debugging (puts / binding.irb / byebug)', ticker: (n) => `${n} leftover debug lines…`, locations: debugLeft,
  })

  // Spots clearly above bootcamp level: only a HINT for the "make sure you can explain these" list (the AI decides)
  const advanced = scan(files, /^(app|lib)\/.*\.(rb|js)$/, /\b(define_method|method_missing|instance_variable_(get|set)|class_eval|instance_eval|public_send|ObjectSpace|Thread\.new|Mutex|with_lock|\.lock!|find_by_sql|connection\.execute|Arel\.|after_commit|ActiveSupport::Concern|Data\.define|MutationObserver|IntersectionObserver|ResizeObserver|new Worker|new Proxy|AudioContext|SpeechSynthesis|webkitSpeech|crypto\.subtle|WebGL)\b|\bfrom ["']three|\bTHREE\.|\btransaction do\b/, { skipComments: true })
  add({
    id: 'advanced-code', categories: ['wagonmade'], severity: 'note',
    title: 'Code that looks well above bootcamp level (possible "can you explain this?" spots)', ticker: (n) => `${n} spots well beyond the course…`, locations: advanced,
  })

  // ── WAGONMADE signals ───────────────────────────────────────────────────────
  const explainer = scan(appCode, /./, /^\s*(#|\/\/|<%#)\s*(Step\s*\d+|This (method|function|action|controller|class|model|file|code|view)\b|Initialize|Define the|Set up|Create a new|Loop through|Handle the|Here we|We (will|are going to)|Make sure)/i)
  add({
    id: 'explainer-comments', categories: ['wagonmade'], severity: 'note',
    title: 'Tutorial-style explainer comments ("Step 1", "This method…")', ticker: (n) => `${n} tutorial-sounding comments…`, locations: explainer,
  })
  const commentedCode = scan(appCode, /./, /^\s*(#|\/\/)\s*(def |end\s*$|render\b|redirect_to\b|before_action\b|@\w+ =|const |function |import )/)
  add({
    id: 'commented-code', categories: ['wagonmade'], severity: 'note',
    title: 'Commented-out code', ticker: (n) => `${n} commented-out code lines…`, locations: commentedCode,
  })
  const placeholder = scan(files, /^app\/views\/.*\.erb$|^README\.md$/i, /lorem ipsum|your (text|title|content) here|welcome to my app|sample text|placeholder text|todo:|fixme/i)
  add({
    id: 'placeholder-copy', categories: ['wagonmade'], severity: 'note',
    title: 'Placeholder copy (Lorem ipsum / "your text here")', ticker: (n) => `${n} placeholder texts…`, locations: placeholder,
  })
  const mixedTemplates = files.filter((f) => /^app\/views\/.*\.(haml|slim|jbuilder)$/.test(f.path) && !/\.jbuilder$/.test(f.path))
  add({
    id: 'mixed-template-languages', categories: ['wagonmade', 'frontend'], severity: 'issue',
    title: 'Views written in HAML/Slim (the course uses ERB)', ticker: (n) => `${n} HAML/Slim views…`,
    locations: mixedTemplates.map((f) => ({ path: f.path, line: 1, snippet: f.path, whole: true })),
  })

  // dead views (no controller / action)
  const deadViews = []
  const ctrlByName = Object.fromEntries(controllers.map((c) => [c.path.match(/controllers\/(.+)_controller\.rb$/)[1], c]))
  for (const v of views) {
    const m = v.path.match(/^app\/views\/([^/]+(?:\/[^/]+)*)\/([^/_][^/]*)\.html\.erb$/)
    if (!m) continue
    const [, dir, action] = m
    if (/^(layouts|devise|shared|pwa|passwords|registrations|sessions|confirmations|unlocks|mailers|kaminari)/.test(dir) || /_mailer$/.test(dir)) continue
    const ctrl = ctrlByName[dir]
    if (!ctrl) {
      deadViews.push({ path: v.path, line: 1, snippet: `No ${dir}_controller.rb for this view`, whole: true })
    } else if (!REST.includes(action) && !new RegExp(`def ${action}\\b`).test(ctrl.content)) {
      deadViews.push({ path: v.path, line: 1, snippet: `${dir}_controller has no "${action}" action`, whole: true })
    }
  }
  add({
    id: 'dead-views', categories: ['wagonmade', 'rails'], severity: 'note',
    title: 'Views with no matching controller or action', ticker: (n) => `${n} views nobody renders…`, locations: deadViews,
  })
  const allViewControllerText = files.filter((f) => /^app\/(views|controllers|helpers)\//.test(f.path))
  const unusedPartials = []
  for (const v of views) {
    const m = v.path.match(/\/_([^/]+)\.html\.erb$/)
    if (!m || /^app\/views\/(devise|shared|layouts|pwa)/.test(v.path)) continue
    const name = m[1]
    const referenced = allViewControllerText.some((f) => f.path !== v.path && new RegExp(`["'/:\\s]${name}\\b|render\\s+@?${name}|render\\s+[\\w@.]*${name}`, 'i').test(f.content))
    if (!referenced) unusedPartials.push({ path: v.path, line: 1, snippet: `partial _${name} is never rendered`, whole: true })
  }
  add({
    id: 'unused-partials', categories: ['wagonmade'], severity: 'note',
    title: 'Partials that nothing renders', ticker: (n) => `${n} partials never rendered…`, locations: unusedPartials,
  })

  // ── Stats given to the AI as context ───────────────────────────────────────
  const stats = {
    models: models.length,
    controllers: controllers.length,
    views: views.filter((v) => !/\/_/.test(v.path)).length,
    partials: views.filter((v) => /\/_/.test(v.path)).length,
    stimulusControllers: stimulusNames.length,
    scssFiles: scss.length,
    routesResources: routes.resources,
    routesCustom: routes.custom.length,
    simpleFormUses: simpleForm.length,
    formWithUses: formWith.length,
    leWagonComponentsUsed: usedComps,
    usesRubyLLM: usesRubyLLM > 0,
    hasUploads: attachments.length > 0 || fileFields.length > 0,
    hasDevise: devise,
    authInApplicationController: authInApp,
    dotenvGem,
  }

  const features = {
    ai: usesRubyLLM > 0 || rawOpenAI.length > 0 || gems.has('ruby_llm') || hasOpenAIGem,
    uploads: attachments.length > 0 || fileFields.length > 0 || gems.has('cloudinary'),
  }

  return { versions, gems: [...gems].sort(), stats, features, checks }
}

// In PR mode, keep only hits that land on lines the PR actually changed.
export function limitChecksToPR(result, files) {
  const changed = Object.fromEntries(files.filter((f) => f.changed).map((f) => [f.path, f.changed]))
  const keep = (loc) => {
    const ranges = changed[loc.path]
    if (!ranges) return false
    return loc.whole || ranges.some(([a, b]) => loc.line >= a && loc.line <= b)
  }
  const checks = result.checks
    .map((c) => ({ ...c, locations: c.locations.filter(keep) }))
    .filter((c) => c.locations.length)
    .map((c) => ({ ...c, count: c.locations.length }))
  return { ...result, checks }
}

// Plain-text version of the facts for the AI prompt
export function factsForCategory(result, category) {
  const wanted = category.checks.includes('*') ? null : category.checks
  const rows = result.checks.filter((c) => !wanted || c.categories.some((x) => wanted.includes(x)))
  const notes = []
  if (category.id === 'ai_assets' || category.id === 'security') {
    notes.push(result.stats.hasUploads
      ? 'UPLOADS: this app DOES attach files (Active Storage attachments or file fields).'
      : 'UPLOADS: this app has NO uploads (no has_one_attached / has_many_attached / file fields). Do NOT mention Cloudinary, Active Storage or storage.yml.')
  }
  if (!rows.length) return [...notes, 'No automated findings for this category.'].join('\n')
  return [...notes, ...rows
    .map((c) => {
      const locs = c.locations.slice(0, 6).map((l) => `    - ${l.path}:${l.line}  ${l.snippet}`).join('\n')
      return `* [${c.severity}] ${c.title} — ${c.count} found${c.detail ? ` (e.g. ${c.detail})` : ''}\n${locs}`
    })]
    .join('\n')
}
