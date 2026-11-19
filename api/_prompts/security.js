export default `
SECURITY & HYGIENE: secrets, .gitignore, master.key, auth on actions that need it.

Look for:
- Secrets: API keys or tokens committed, .env or config/master.key in the repo (see AUTOMATED FACTS: values are redacted, never repeat them). .gitignore covering .env*, /config/*.key, node_modules, tmp, log.
- Access control: Devise's authenticate_user! on controllers/actions that create, edit or delete data; records scoped to current_user (e.g. current_user.bookmarks.find) rather than any record by id; strong params (no params.permit!); admin-like pages without any protection.
- Hygiene: no debug output (puts, binding.irb, byebug), no leftover test routes, production config sane (force_ssl default untouched is fine).
- Mass assignment, raw SQL string interpolation (where("name = '#{params[:q]}'")), html_safe / raw on user input.
Wins to look for: .env gitignored, authenticate_user! in ApplicationController, scoping to current_user, strong params.
Finding a record with a bare Model.find(params[:id]) (or find(params[:trip_id])) when that model belongs to a user (current_user.trips.find is the way we learned it) is the most important authorisation level-up: confidence "high", impact 5. The AUTOMATED FACTS list these spots when they found any. Report it ONCE for the whole app (quote the clearest spot), not once per controller.
A hit on committed secrets is the most important level-up (impact 5, confidence high) and must explain kindly what to do: remove the file from git, rotate the key.
`.trim()
