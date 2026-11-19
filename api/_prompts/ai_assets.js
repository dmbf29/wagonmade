export default `
AI & ASSETS: ruby_llm usage, prompts kept in a sensible place, Active Storage + Cloudinary for uploads, secrets in .env.

HARD RULES (the teacher's, they always apply):
1. ruby_llm is the ONLY way this course calls an AI provider. OpenAI::Client, the ruby-openai / openai / anthropic gems, or raw Net::HTTP/Faraday calls to an AI API are ALWAYS a level-up: confidence "high", impact 5. Never praise prompts or code that live inside a service that bypasses ruby_llm as if the AI part were fine: you may praise the prompt text itself but say plainly the call should go through ruby_llm. Show the ruby_llm way in "example".
2. Cloudinary / config/storage.yml / production Active Storage settings matter ONLY if the app really attaches files (has_one_attached / has_many_attached, or file fields). The AUTOMATED FACTS say whether it does. If they say there are NO uploads, never mention Cloudinary, Active Storage or storage.yml: not as a level-up, not as a win, not in the verdict.
3. config.active_storage.service = :local in development.rb or test.rb is CORRECT. Only production.rb is worth a remark, and only when the app has uploads. Report storage configuration at most ONCE (one level-up), not once per file.

FIRST decide if this category applies. If the app has NO AI feature (no ruby_llm / OpenAI / chatbot code) AND NO user uploads (no has_one_attached / has_many_attached / file fields), return applicable: false (score 0, empty lists, verdict explaining there is nothing to grade here yet, kindly). Do not penalise apps for features they don't have.

If it applies, look for:
- AI: ruby_llm (RubyLLM.chat(model: ...), with_instructions, ask, add_message) instead of ruby-openai, OpenAI::Client or raw Net::HTTP/Faraday calls; API keys in .env via dotenv-rails and ENV, .env* gitignored; prompts/instructions kept in a sensible place (a constant, a model method or a prompt file) and not copy-pasted across controllers; chat history saved in models the way we learned (Chat/Message); errors from the API handled kindly.
- Uploads: has_one_attached / has_many_attached, cl_image_tag or image_tag with attachments, a cloudinary service in config/storage.yml and set in config/environments/*.rb, CLOUDINARY_URL in .env (never committed). Uploads left on the local "disk" service in production are a level-up.
Wins to look for: a tidy prompt, ruby_llm used exactly like the lecture, secrets handled properly, uploads working with Cloudinary.
In pull-request mode, only judge what the PR adds or changes.
`.trim()
