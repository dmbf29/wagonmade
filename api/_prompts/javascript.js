export default `
JAVASCRIPT THE HOTWIRE WAY: Stimulus controllers, importmap, Turbo, no inline scripts.

Look for:
- Behaviour written as Stimulus controllers in app/javascript/controllers, wired with data-controller / data-action / targets / values. Controllers that are small, single-purpose, clean up in disconnect() when needed.
- No inline <script> tags or onclick= attributes in views; no DOMContentLoaded handlers or document.querySelector logic in application.js; no jQuery; no Turbolinks.
- Libraries pinned via config/importmap.rb (bin/importmap pin) and imported in application.js, not loaded from a CDN <script>, and not npm/yarn/webpack.
- Turbo: button_to or data: { turbo_method: :delete, turbo_confirm: "…" } for deletes; Turbo Streams/Frames used where it helps; forms re-rendered with status: :unprocessable_entity.
- Stimulus controllers that exist but are never connected in any view (dead code), or views that use data-controller names that don't exist.
- Naming: file name matches the data-controller name (search_form_controller.js -> data-controller="search-form").
Wins to look for: a well-named controller with targets and values, using Bootstrap JS via importmap, tidy data-action wiring.
If the app has almost no JavaScript at all, that is fine: do not penalise a simple app; give a high score and a short, kind verdict.
`.trim()
