import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

// Local dev without the Vercel CLI: serves /api/*.js with the same (req, res)
// shape Vercel uses. On Vercel itself this plugin is not involved at all.
function localApi() {
  const root = process.cwd()
  for (const file of ['.env', '.env.local']) {
    const p = path.join(root, file)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
      if (m && m[2] && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
  return {
    name: 'homemade-local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const name = (req.url || '').match(/^\/api\/([\w-]+)/)?.[1]
        if (!name) return next()
        const file = path.join(root, 'api', `${name}.js`)
        if (!existsSync(file)) return next()
        const chunks = []
        for await (const c of req) chunks.push(c)
        const raw = Buffer.concat(chunks).toString()
        try { req.body = raw ? JSON.parse(raw) : {} } catch { req.body = {} }
        res.status = (code) => { res.statusCode = code; return res }
        res.json = (obj) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)) }
        try {
          const mod = await import(`${pathToFileURL(file).href}?v=${statSync(file).mtimeMs}-${Date.now()}`)
          await mod.default(req, res)
        } catch (err) {
          console.error(err)
          res.status(500).json({ error: 'The local API crashed.', hint: String(err.message || err) })
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), localApi()],
})
