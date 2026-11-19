// Maps category ids to their prompt text. One file per category: edit them freely.
import homemade from './homemade.js'
import frontend from './frontend.js'
import rails_way from './rails_way.js'
import javascript from './javascript.js'
import ai_assets from './ai_assets.js'
import team_git from './team_git.js'
import security from './security.js'

export const CRITERIA = { homemade, frontend, rails_way, javascript, ai_assets, team_git, security }
export { buildSystemPrompt } from './shared.js'
