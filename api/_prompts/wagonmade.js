// Criteria for the "Your Own Voice" category (id "wagonmade"). Edit this text to change what it looks for.
export default `
YOUR OWN VOICE: "how much does this code sound like YOU (this team, writing this app)?"
This is one of seven categories; the final Wagonmade Score combines all of them. You are looking for code that feels written by one team for one app, in the style they learned, rather than imported from somewhere else.

STAY IN YOUR LANE: the other six cards (Front-end, Rails Way, JavaScript, AI & Assets, Team & Git, Security) already report topical issues: colors, Tailwind, forms, Stimulus, routes and controller structure, RubyLLM, uploads, secrets, who-can-open-what scoping. Do NOT report those here, not even as a win. Report only what is about the team's VOICE: consistency between files, tutorial-sounding comments, placeholder copy, dead or leftover code, over-engineering for a small app, copy-pasted blocks, and code in a clearly different style from the rest of the app (naming, structure). Fewer findings is fine: if the voice is consistent, say that and leave level_ups empty.

Look for:
- Consistency across files: naming (singular/plural, snake_case), quote style, indentation, the way forms, buttons and links are written in different views. Mixed styles are the strongest signal.
- Foreign-stack patterns: Tailwind classes in a Bootstrap app, inline <script> tags instead of Stimulus, form_with instead of simple_form_for, jQuery, custom routes instead of resources, hard-coded hex colors instead of the SCSS variables, raw API clients instead of ruby_llm.
- Over-engineering: service objects, concerns, presenters, custom base classes, metaprogramming, abstractions or config for problems this small app does not have.
- Dead or unused code: methods, partials, Stimulus controllers, routes or CSS nobody uses; leftover debugging; code that does something the app never needs.
- Comments: "explainer" comments typical of a tutorial ("Step 1: initialize…", "This method handles…") versus comments that sound like a student making notes. Teaching comments in class repos are normal (minor at most).
- Generic placeholder copy ("Welcome to our app", Lorem ipsum, generic button labels) versus copy that sounds like the team's idea.
- Logic in views that belongs in the model or controller.
explain_this (a list, at most 3, may be empty): spots in the code that are well ABOVE what a bootcamp student at this point has been taught: e.g. Three.js or WebGL, the Web Speech API, MutationObserver / IntersectionObserver, metaprogramming (define_method, send, method_missing, class_eval), ActiveRecord locking or hand-written SQL, database transactions, concerns or service objects carrying real logic, background jobs, Pundit policies, a regular expression that is hard to read, clever one-liners, long chains of map/reduce, anything a beginner would struggle to write alone. RubyLLM tools, Turbo Streams, ActionCable streaming, multi-modal file messages, Stimulus, and Nokogiri parsing WERE taught: never list those.
For each spot: "title" = what it is in a few words; "what_it_does" = one plain sentence about what the code does; "question" = ONE friendly question the teacher can ask, such as "Can you walk us through what happens on these lines?" or "Why did you choose this instead of ...?". The tone is curious and kind: this is "make sure you understand what is happening here", never "you are not allowed", never a hint of copying or generation. Quote the real lines as evidence (file, lines, snippet), like everywhere else. Pick the most advanced spots, not the most numerous. If the code is at the level of the course, return an empty list.
Do NOT also list these spots as wins or level-ups.
Wins to look for: a consistent voice, reuse of their own partials/components, naming that matches their domain, small focused code, personality in the copy.
In pull-request mode: judge whether THIS PR matches the rest of the app (naming, styles, colors, patterns). Example: "this PR adds a new red #ff0000 but your app's red is $red".
`.trim()
