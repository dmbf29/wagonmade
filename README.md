# Wagonmade

A friendly code-check report card for Le Wagon student Rails projects. Paste a GitHub repo or pull request URL and get grades, wins, level-ups with real code evidence, and three missions for the final project.

React + Vite on the front, a few Vercel serverless functions in `/api`, no database (reports live in the browser's `localStorage`).

## Run it locally

```bash
npm install
cp .env.example .env     # then fill in OPENAI_API_KEY and GITHUB_TOKEN
npm run dev              # http://localhost:5173
```

`npm run dev` serves `/api/*` itself, so you don't need the Vercel CLI. To mimic Vercel exactly use `vercel dev` instead.

Try it without spending tokens: set `MOCK_LLM=1` in `.env`. The AI step is faked (with real evidence, one fabricated finding the verifier removes) so you can click through the whole UI.

Check the quick checks alone on the two reference repos (no AI, no OpenAI key):

```bash
GITHUB_TOKEN=$(gh auth token) npm run check:repos
```

## Environment variables

| Name | Required | What it is |
|---|---|---|
| `OPENAI_API_KEY` | yes | Your OpenAI key. Stays on the server. |
| `GITHUB_TOKEN` | strongly advised | Read-only fine-grained token (Contents, Pull requests, Metadata: read). Without it GitHub allows 60 requests/hour, and private repos won't work. |
| `OPENAI_MODEL` | no | Any model that supports Structured Outputs. Defaults to `DEFAULT_OPENAI_MODEL` in `shared/config.js`. **Check that default is current before class** (I couldn't verify OpenAI's catalogue). |
| `OPENAI_REASONING_EFFORT` | no | `low` / `medium` / `high`, only for reasoning models. `low` is faster. |
| `MOCK_LLM` | no | `1` fakes the AI step. |

## Deploy

1. Push this folder to GitHub.
2. In Vercel: **Add New → Project**, import it. Framework preset "Vite" is detected.
3. Add the env vars above (Settings → Environment Variables), then deploy.
4. Drop the official logo at `public/logo.svg` (the header slot hides itself until the file exists).

`vercel.json` sets `maxDuration: 60` for the two functions. If your plan allows more, raise it for `api/analyze.js`.

## How a run works

1. **`POST /api/fetch-repo`** downloads the repo in one tarball request, drops `vendor/`, `node_modules/`, `public/`, images, migrations, tests…, diffs the stylesheets against `lewagon/rails-stylesheets@rails-8` (identical files are not judged), scans for committed secrets (values are never sent back), and collects Git data (PRs, contributors, commits). In PR mode it fetches the PR's head, so the base app and the changed lines arrive together.
2. **Quick checks** (`shared/checks.js`, plain JS) run in the browser from that data: Tailwind and Bootstrap 4 classes, inline styles, custom routes, form_with, jQuery, hex colors, unused Stimulus controllers, and more. They appear live as "Found 3 custom routes…".
3. **`POST /api/analyze`**, once per category, **in parallel**. Each gets the relevant files (size-capped), the quick-check facts, and the versions from `Gemfile.lock`, and answers in a JSON schema. Each card appears as soon as its call finishes.
4. **Verification** (`api/_lib/verify.js`): every evidence snippet must exist in the fetched file near the stated lines. Small line-number slips are corrected, the displayed snippet is replaced by the real lines, and anything that can't be found is dropped ("X unverifiable findings removed"). Git findings are checked against the Git facts.

The browser does the orchestration so no single function has to do everything.

## Where to change things

| I want to… | Edit |
|---|---|
| Rename categories, change weights, grade thresholds, which files each sees, the house-style text | `shared/config.js` |
| Change what the AI looks for, or the tone | `api/_prompts/*.js` (one file per category; `shared.js` has tone, rules, scoring) |
| Add or tune a quick check | `shared/checks.js` |
| Change colors/fonts | CSS variables at the top of `src/styles.css` |

(The prompts live in `api/_prompts/`, not `api/prompts/`, because Vercel turns every non-underscore file in `/api` into a public endpoint.)

## Using it in class

- **Presentation mode**: full screen, one category per slide. `←`/`→` move, `C` shows/hides code, `Esc` leaves.
- **History** (top right): reopen any past report instantly. **Export all** and **Import** move reports between computers, so prepare the night before and import them on the classroom machine. Reports store findings only, never the code.
- **Copy as Markdown** pastes a report into a GitHub issue or PR.
- If a run fails, the error screen offers the last saved report for that repo.

## Big categories are read in parts

When a category's files add up to more than ~45k characters (`SPLIT` in `src/lib/split.js`), the browser cuts them into 2-3 balanced parts and sends one "findings" call per part, in parallel. Each part is verified against its own files. Then the best 3 wins and 3 level-ups are merged and one small "summary" call (no code in it) writes the score and verdict. This keeps every call well under the 60 s limit. Small categories still use a single call.

The quick-check list is saved in each report (`quickChecks`) and shown under the missions, in Markdown and in the export.

## Phase 2 features

- **Weights** (⚖ Weights in the report toolbar): sliders per category, saved in this browser. They only change the Wagonmade Score and the mission order. Saved reports are untouched.
- **Re-run this category** (open a card, or on one that failed): redoes just that category and saves the report.
- **What changed**: when an older report of the same repo (and PR) exists, a panel shows score moves, level-ups you tackled, new wins and new things to try.
- **Compare**: tick two reports in History, then "Compare 2" for a side-by-side table. For two runs of the same project it also shows the differences.
- `node scripts/smoke-phase2.mjs <dev-server-url> <github-url>` checks all of this with `MOCK_LLM=1`.

## Limitations

- Re-running one category fetches the code again. If the code moved on (a PR got new commits) it asks you to run the full check, so scores stay comparable.
- "What changed" matches level-ups by file + concept, so a reworded finding can show as one tackled and one new.
- Quick checks are heuristics (regex-based). Tuned on the two reference repos; expect the odd false positive on other projects.
- Prioritising "files the team changed most" would need per-file commit history; instead files are prioritised by relevance to each category, and skipped files are mentioned to the AI.
- "Direct pushes to main" are approximate: squash/rebase merges can look like direct commits.
- localStorage is per browser and per origin. Export before clearing site data.
