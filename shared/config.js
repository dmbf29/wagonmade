// ─────────────────────────────────────────────────────────────────────────────
// Homemade · one config file to rule them all.
//
// Edit this file to change: category names and weights, grade thresholds,
// which files each category looks at, and the "house style" the AI is told
// about. The AI prompts themselves live in /api/_prompts/*.js.
//
// This file is imported by BOTH the browser (src/) and the serverless
// functions (api/), so keep it plain JavaScript with no imports.
// ─────────────────────────────────────────────────────────────────────────────

// ── Which OpenAI model to use ────────────────────────────────────────────────
// Override with the OPENAI_MODEL env var. It must support Structured Outputs
// (response_format: json_schema). We could not check OpenAI's catalogue when
// writing this, so if the default is rejected, set OPENAI_MODEL in Vercel.
export const DEFAULT_OPENAI_MODEL = 'gpt-5-mini'

// ── Grades ───────────────────────────────────────────────────────────────────
// A score is turned into a letter using the first band whose `min` it reaches.
export const GRADE_BANDS = [
  { grade: 'A', min: 85 },
  { grade: 'B', min: 72 },
  { grade: 'C', min: 58 },
  { grade: 'D', min: 45 },
  { grade: 'E', min: 0 },
]

export function gradeFor(score) {
  const s = Number.isFinite(score) ? score : 0
  return GRADE_BANDS.find((band) => s >= band.min).grade
}

// ── Limits ───────────────────────────────────────────────────────────────────
export const LIMITS = {
  // Max characters of code sent to the AI for ONE category.
  perCategoryChars: 90000,
  // Max total characters of file content returned by /api/fetch-repo
  // (Vercel caps response bodies at ~4.5 MB, so stay below that).
  fetchResponseChars: 3300000,
  // Files bigger than this are skipped (minified bundles, big fixtures…)
  maxFileBytes: 200000,
  // Extra safety net for the tarball download
  maxTarballBytes: 150 * 1024 * 1024,
  // Only the N most recent PRs get detailed lookups (size, reviews)
  detailedPullRequests: 12,
  recentCommits: 100,
}

// ── Categories ───────────────────────────────────────────────────────────────
// weight  : how much it counts in the overall grade (N/A categories are ignored)
// kind    : "code" categories get files, "git" gets workflow facts only
// files   : regexes, in PRIORITY order. A file's priority is the index of the
//           first regex it matches. Files matching none are not sent.
// checks  : which deterministic checks (shared/checks.js) are passed along as facts
export const CATEGORIES = [
  {
    id: 'homemade',
    name: 'Homemade Score',
    tagline: 'How much it sounds like you',
    weight: 3,
    kind: 'code',
    headline: true,
    checks: ['*'], // sees every deterministic fact
    files: [
      /^README\.md$/i,
      /^app\/controllers\/.*\.rb$/,
      /^app\/models\/.*\.rb$/,
      /^app\/views\/.*\.erb$/,
      /^app\/javascript\/.*\.js$/,
      /^app\/assets\/stylesheets\/.*\.scss$/,
      /^app\/(helpers|jobs|services|lib|prompts)\/.*\.rb$/,
      /^config\/routes\.rb$/,
    ],
  },
  {
    id: 'frontend',
    name: 'Front-end Consistency',
    tagline: 'Bootstrap 5, SCSS and one look',
    weight: 2.5,
    kind: 'code',
    checks: ['frontend'],
    files: [
      /^app\/assets\/stylesheets\/config\/_(colors|fonts|bootstrap_variables)\.scss$/,
      /^app\/assets\/stylesheets\/application\.scss$/,
      /^app\/assets\/stylesheets\/(components|pages)\/_index\.scss$/,
      /^app\/views\/layouts\/application\.html\.erb$/,
      /^app\/assets\/stylesheets\/.*\.(scss|css)$/,
      /^app\/views\/.*\.erb$/,
      /^app\/helpers\/.*\.rb$/,
    ],
  },
  {
    id: 'rails_way',
    name: 'Rails Way',
    tagline: 'Routes, controllers, models',
    weight: 2,
    kind: 'code',
    checks: ['rails'],
    files: [
      /^config\/routes\.rb$/,
      /^app\/controllers\/.*\.rb$/,
      /^app\/models\/.*\.rb$/,
      /^db\/schema\.rb$/,
      /^app\/(helpers|jobs|services|lib)\/.*\.rb$/,
      /^app\/views\/.*\.erb$/,
    ],
  },
  {
    id: 'javascript',
    name: 'JavaScript the Hotwire Way',
    tagline: 'Stimulus, importmap and Turbo',
    weight: 1.5,
    kind: 'code',
    checks: ['javascript'],
    files: [
      /^config\/importmap\.rb$/,
      /^app\/javascript\/application\.js$/,
      /^app\/javascript\/controllers\/(?!application\.js|index\.js).*\.js$/,
      /^app\/javascript\/.*\.js$/,
      /^app\/views\/layouts\/application\.html\.erb$/,
      /^app\/views\/.*\.erb$/,
    ],
  },
  {
    id: 'ai_assets',
    name: 'AI & Assets',
    tagline: 'ruby_llm, Active Storage, Cloudinary',
    weight: 1,
    kind: 'code',
    canBeNA: true,
    checks: ['ai'],
    files: [
      /^config\/initializers\/(?!simple_form).*\.rb$/,
      /^config\/storage\.yml$/,
      /^config\/environments\/.*\.rb$/,
      /^app\/(services|lib|prompts)\/.*\.rb$/,
      /^app\/models\/.*\.rb$/,
      /^app\/controllers\/.*\.rb$/,
      /^app\/views\/.*\.erb$/,
      /^\.gitignore$/,
    ],
  },
  {
    id: 'team_git',
    name: 'Team & Git Workflow',
    tagline: 'Branches, pull requests, teamwork',
    weight: 1,
    kind: 'git',
    checks: ['git'],
    files: [],
  },
  {
    id: 'security',
    name: 'Security & Hygiene',
    tagline: 'Secrets, .gitignore, who can do what',
    weight: 1,
    kind: 'code',
    checks: ['security'],
    files: [
      /^\.gitignore$/,
      /^app\/controllers\/application_controller\.rb$/,
      /^config\/routes\.rb$/,
      /^config\/storage\.yml$/,
      /^config\/environments\/.*\.rb$/,
      /^config\/initializers\/(?!simple_form).*\.rb$/,
      /^app\/controllers\/.*\.rb$/,
      /^app\/models\/.*\.rb$/,
    ],
  },
]

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))

// ── Which files to download from a repo (used by /api/fetch-repo) ───────────
// A path is INCLUDED if it matches one of these…
export const INCLUDE_PATTERNS = [
  /^Gemfile(\.lock)?$/,
  /^config\/routes\.rb$/,
  /^config\/importmap\.rb$/,
  /^config\/storage\.yml$/,
  /^config\/application\.rb$/,
  /^config\/environments\/[^/]+\.rb$/,
  /^config\/initializers\/[^/]+$/,
  /^db\/schema\.rb$/,
  /^app\/.*/,
  /^\.gitignore$/,
  /^README\.md$/i,
]

// …unless it matches one of these. (Matched against the full path.)
export const SKIP_PATTERNS = [
  /^(vendor|node_modules|tmp|log|public|storage|bin|test|spec|db\/migrate)\//,
  /^app\/assets\/(builds|images|fonts)\//,
  /^app\/views\/pwa\//,
  /^app\/assets\/stylesheets\/(LICENSE|README.*)$/,
  /\.(png|jpe?g|gif|webp|avif|svg|ico|bmp|pdf|woff2?|ttf|otf|eot|mp[34]|mov|webm|zip|gz|map|lock\.bak)$/i,
  /\.min\.(js|css)$/,
  /\/\.keep$/,
]

// ── Template boilerplate (not the students' work) ───────────────────────────
// Files from the Le Wagon template that students normally don't write.
// These are NOT analysed and NOT judged. (Stylesheets are handled separately:
// we diff them against lewagon/rails-stylesheets and only judge the changes.)
export const TEMPLATE_PATTERNS = [
  /^app\/views\/devise\//,
  /^app\/views\/shared\/_(navbar|flashes)\.html\.erb$/,
  /^app\/views\/layouts\/mailer\.(html|text)\.erb$/,
  /^app\/javascript\/controllers\/(application|index|hello_controller)\.js$/,
  /^app\/models\/application_record\.rb$/,
  /^app\/jobs\/application_job\.rb$/,
  /^app\/mailers\/application_mailer\.rb$/,
  /^config\/initializers\/(simple_form|simple_form_bootstrap|devise|assets|content_security_policy|filter_parameter_logging|inflections|permissions_policy)\.rb$/,
]

// The official stylesheet repo we diff against (fetched at runtime)
export const STYLESHEETS_TEMPLATE = {
  owner: 'lewagon',
  repo: 'rails-stylesheets',
  ref: 'rails-8',
  // files in that repo live at the root; in a Rails app they live here:
  mountAt: 'app/assets/stylesheets/',
}

// ── PR mode: which UNCHANGED files give the AI context ──────────────────────
export const PR_CONTEXT_PATTERNS = [
  /^config\/routes\.rb$/,
  /^app\/assets\/stylesheets\/config\/_(colors|fonts)\.scss$/,
  /^app\/assets\/stylesheets\/(components|pages)\/_index\.scss$/,
  /^app\/assets\/stylesheets\/components\//,
  /^config\/importmap\.rb$/,
  /^db\/schema\.rb$/,
  /^app\/models\//,
  /^app\/javascript\/controllers\/.*_controller\.js$/,
]

// ── Gems whose versions we report (read from Gemfile.lock) ──────────────────
export const TRACKED_GEMS = [
  'rails',
  'bootstrap',
  'font-awesome-sass',
  'simple_form',
  'ruby_llm',
  'devise',
  'cloudinary',
  'dotenv-rails',
  'sprockets-rails',
  'sassc-rails',
  'importmap-rails',
  'turbo-rails',
  'stimulus-rails',
]

// ── The house style: what students were taught ───────────────────────────────
// This text is given to the AI so it judges against OUR course, not against
// "best practice on the internet". Edit freely.
export const HOUSE_STYLE = `
Students generate their app from the Le Wagon Rails template (Rails 8). This is the stack they were taught:

- sprockets-rails + sassc-rails (Propshaft is removed) so they can use SCSS. app/assets/config/manifest.js links images and stylesheets.
- Bootstrap 5 (gem) with Popper, pinned via importmap (config/importmap.rb) and imported in app/javascript/application.js. There is NO npm, esbuild or jsbundling. Bootstrap 4/3 classes (ml-*, mr-*, data-toggle, form-group, badge-*, float-left, text-left…) are mismatches. Bootstrap 5 is assumed whatever the minor version.
- SCSS structure from lewagon/rails-stylesheets: application.scss imports config/fonts, config/colors, config/bootstrap_variables, then bootstrap, font-awesome, then components/index and pages/index. Each component lives in components/_name.scss and is imported in components/_index.scss. Page-specific styles go in pages/. Colors are SCSS variables in config/_colors.scss. Fonts are Google fonts in config/_fonts.scss ($body-font, $headers-font; defaults Work Sans + Nunito).
- Le Wagon UI kit components: .banner, .card-category / .card-product, .avatar, navbar, alerts, .cards grid. Reusing these is GOOD.
- font-awesome-sass ~> 6.1 (fa-solid fa-… classes). No CDN <script>/<link> for icons.
- simple_form with the Bootstrap config (simple_form_for, f.input, f.association, f.button :submit). Not form_with / form_tag.
- Devise for users (before_action :authenticate_user! in ApplicationController, skip_before_action for public pages), PagesController#home as root.
- Hotwire: Turbo + Stimulus controllers in app/javascript/controllers (data-controller / data-action / targets / values). Deletes use button_to … method: :delete or data: { turbo_method: :delete, turbo_confirm: … }. No inline <script> tags, no jQuery, no DOMContentLoaded handlers, no document.querySelector logic in application.js.
- Routes with resources (with only: and nesting), the 7 RESTful actions, strong params (params.require(...).permit(...)), render :new, status: :unprocessable_entity on failed saves, redirect_to on success. Custom get "/whatever" routes are a smell when resources would do.
- ruby_llm for AI features (RubyLLM.chat(model: ...), with_instructions, ask, add_message), keys in .env via dotenv-rails, .env* gitignored. Not ruby-openai, not raw Net::HTTP.
- Active Storage + Cloudinary for user uploads (has_one_attached / has_many_attached, cl_image_tag or image_tag with attachments, cloudinary service in config/storage.yml, CLOUDINARY_URL in .env).
- RuboCop config from Le Wagon. Generators skip helpers/assets.

Teaching comments and commented-out alternatives are normal in class repos: at most a minor note, never a serious issue.
`.trim()
