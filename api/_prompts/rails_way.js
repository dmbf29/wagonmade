export default `
RAILS WAY: routes, RESTful controllers, strong params, models/validations/associations, Devise usage, skinny controllers.

Look for:
- Routes: resources with only: and sensible nesting instead of custom get/post routes; root route set; no routes for actions that do not exist.
- Controllers: the 7 RESTful actions, before_action for finding records, strong params (params.require(...).permit(...)), redirect_to on success, render :new/:edit with status: :unprocessable_entity on failure, skinny actions (business logic belongs in models).
- Models: associations with dependent: where it matters, validations, scopes instead of repeated queries in controllers/views, no database queries in views.
- Devise: before_action :authenticate_user! in ApplicationController with skip_before_action for public pages; current_user used to scope records (e.g. current_user.lists) instead of trusting params.
- Schema sanity: foreign keys/references for associations, sensible table and column names.
- Names: singular models, plural controllers and tables, conventional file names.
Wins to look for: clean nested resources, tidy private methods, scopes, validations, current_user scoping.
In pull-request mode, check that new routes/controllers/models follow the same conventions as the existing app.
`.trim()
