import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

/** In development and preview, serve /app like Vercel does in production (cleanUrls). */
const rewriteApp = (req: { url?: string }, _res: unknown, next: () => void) => {
  if (req.url === '/app' || req.url?.startsWith('/app?')) req.url = req.url.replace('/app', '/app.html')
  next()
}
const cleanAppUrl: Plugin = {
  name: 'clean-app-url',
  configureServer(server) { server.middlewares.use(rewriteApp) },
  configurePreviewServer(server) { server.middlewares.use(rewriteApp) },
}

// Two pages: the landing at / (index.html) and the application at /app (app.html).
export default defineConfig({
  plugins: [cleanAppUrl],
  build: {
    rollupOptions: {
      input: {
        landing: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app.html'),
      },
    },
  },
})
