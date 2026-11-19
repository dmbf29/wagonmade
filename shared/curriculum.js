// What the students were really taught, read from the Le Wagon challenges (challenges/05-Rails README + days).
// Two uses:
//   1) CONCEPTS is the closed list the AI must pick the "you already know" concept from (no invented lectures)
//   2) NOT_YET are topics from the later Projects module: we never suggest them as a fix
// Edit freely: it is plain data.

export const CONCEPTS = [
  // ── Rails 101 ──
  'Routing, controllers & views (Rails 101)',
  'Models & CRUD, resources (Rails 101)',
  'Advanced routing: nested resources & validations',
  'Rails assets: Bootstrap SCSS, color variables, asset pipeline',
  'simple_form_for with the Bootstrap config',
  'Hosting on Heroku',
  'Image upload: Active Storage & Cloudinary',
  'Secrets with dotenv (.env)',
  // ── AI Week ──
  'Intro to LLMs: RubyLLM',
  'Authentication with Devise',
  'Prompt engineering: persona, context, task, format',
  'Git & GitHub: branches and pull requests',
  'Conversational UX: chat history & Turbo Streams',
  'JavaScript in Rails: Stimulus & importmap',
  'Multi-modal inference (files with text)',
  'Tools & Agents (RubyLLM tools)',
  'WebSockets & ActionCable',
  // ── earlier weeks ──
  'Active Record & the database (DB lecture)',
  'Ruby & OOP basics',
  'HTTP, APIs & parsing (JSON, Nokogiri)',
  'HTML, CSS & Bootstrap components',
]

// Taught LATER (Projects module). Advice that needs these is dropped, and apps using them are not "wrong".
export const NOT_YET = [
  { name: 'Background jobs (Active Job / Sidekiq)', re: /active ?job|background job|sidekiq|perform_later|solid_queue/i },
  { name: 'Authorization with Pundit', re: /pundit|policy class|authorization polic/i },
  { name: 'Search (pg_search, Algolia, Elasticsearch)', re: /pg_search|algolia|elastic ?search/i },
  { name: 'Embeddings & RAG', re: /embedding|\brag\b|pgvector/i },
  { name: 'i18n', re: /\bi18n\b|internationali[sz]ation/i },
  { name: 'Testing (minitest / rspec / system tests)', re: /\b(minitest|rspec|system tests?|unit tests?|write tests|add tests|test coverage)\b/i },
  { name: 'Stripe payments', re: /stripe/i },
  { name: 'Advanced admin / building an API', re: /rails_admin|administrate|active ?admin/i },
]

export const COURSE_TEXT = `
WHAT THE STUDENTS HAVE BEEN TAUGHT (Le Wagon, in this order). Their project is built in "AI Week", right after Rails 101:
${CONCEPTS.map((c) => `- ${c}`).join('\n')}
Things they did NOT learn yet (they come later, in the Projects module): ${NOT_YET.map((n) => n.name).join('; ')}. Never recommend these as a fix, and do not call code that uses them wrong: it is simply ahead of the course.
Rules from the course itself:
- AI calls go through RubyLLM only (the "Intro to LLMs" lecture). Prompts follow persona + context + task + format and are sent with with_instructions.
- Forms use simple_form_for (switched from form_with in "Rails assets"). Styling = Bootstrap SCSS + the color/font variables in config/. JavaScript = Stimulus controllers + importmap.
- Uploads (also files sent to the LLM in "Multi-modal") use Active Storage + Cloudinary; keys live in .env with dotenv and are never committed.
- Git: work on a feature branch per user story, merge with pull requests, "never commit on master" once the team starts building. Deploy to production (Heroku) often: demos are never on localhost.
- Tools & Agents, Turbo Streams conversations and ActionCable streaming are taught in AI Week: using them is on-course, not "advanced".
`.trim()
