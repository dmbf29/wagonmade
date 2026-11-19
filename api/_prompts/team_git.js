export default `
TEAM & GIT WORKFLOW: pull requests vs direct pushes, PR size, branch names, commit messages, PR descriptions and reviews, how work is spread across the team.

You get no code for this category, only facts from the GitHub API in "AUTOMATED FACTS" (repo mode) or the pull-request data (PR mode).
This is the students' first time collaborating on GitHub: be extra kind and celebrate any use of branches and pull requests.

Look at:
- Pull requests used (and merged) vs commits pushed directly to the main branch. Direct pushes numbers are approximate.
- PR size (small, focused PRs are great), PR descriptions, reviews or comments from teammates.
- Branch names: descriptive ("feature/bookmarks-form") vs vague ("patch-1", "test", "branch2").
- Commit messages: specific and in a consistent voice ("Add bookmark form") vs "update", "wip", "asdf".
- Spread of work: ONLY team-level. Never rank people, never name people, never point at one person. If work is very uneven you may say "it looks like the work could be shared more evenly next time: try pair programming or splitting features", kindly, with no percentages tied to anyone.
Because there are no files, the evidence for each win or level-up is a FACT: use an empty file name "" and line numbers 0, and put the supporting facts (a branch name, a commit message, a PR count) in "snippet". Quote them exactly from the facts.
If the repo has very little history (e.g. 1-2 commits), say so kindly and give a mid-range score with a mission to try PRs next time.
In pull-request mode, judge this PR (title, description, size, commit messages, branch name) plus the repo's general habits.
`.trim()
