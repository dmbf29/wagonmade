// Criteria for the headline score. Edit this text to change what "homemade" means.
export default `
HOMEMADE SCORE: "how much does this code sound like YOU (this team, writing this app)?"
This is the headline score. You are looking for code that feels written by one team for one app, in the style they learned, rather than imported from somewhere else.

Look for:
- Consistency across files: naming (singular/plural, snake_case), quote style, indentation, the way forms, buttons and links are written in different views. Mixed styles are the strongest signal.
- Foreign-stack patterns: Tailwind classes in a Bootstrap app, inline <script> tags instead of Stimulus, form_with instead of simple_form_for, jQuery, custom routes instead of resources, hard-coded hex colors instead of the SCSS variables, raw API clients instead of ruby_llm.
- Over-engineering: service objects, concerns, presenters, custom base classes, metaprogramming, abstractions or config for problems this small app does not have.
- Dead or unused code: methods, partials, Stimulus controllers, routes or CSS nobody uses; leftover debugging; code that does something the app never needs.
- Comments: "explainer" comments typical of a tutorial ("Step 1: initialize…", "This method handles…") versus comments that sound like a student making notes. Teaching comments in class repos are normal (minor at most).
- Generic placeholder copy ("Welcome to our app", Lorem ipsum, generic button labels) versus copy that sounds like the team's idea.
- Logic in views that belongs in the model or controller.
Wins to look for: a consistent voice, reuse of their own partials/components, naming that matches their domain, small focused code, personality in the copy.
In pull-request mode: judge whether THIS PR matches the rest of the app (naming, styles, colors, patterns). Example: "this PR adds a new red #ff0000 but your app's red is $red".
`.trim()
