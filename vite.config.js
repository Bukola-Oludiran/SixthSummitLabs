import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function sharedOriginRoutes(server) {
  server.middlewares.use((req, res, next) => {
    const url = new URL(req.url, 'http://localhost')
    // NocoBase's development HTML uses these two root-relative public files.
    if (['/global.css', '/browser-checker.js'].includes(url.pathname)) {
      res.writeHead(302, { Location: `/crm${req.url}` }); res.end(); return
    }
    if (/^\/(?:designs|crm)(?:\/|$)/.test(url.pathname)) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive')
      res.setHeader('Referrer-Policy', 'no-referrer')
      res.setHeader('Cache-Control', 'no-store')
    }
    next()
  })
}

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/backend/**'],
    },
    proxy: {
      '^/crm/(?!leads(?:/|$)|follow-ups(?:/|$)|analytics(?:/|$)|designs(?:/|$)|login(?:/|$)).+': { target: 'http://127.0.0.1:13000', changeOrigin: false, ws: true },
      '/prospect-api': { target: 'http://127.0.0.1:13010', changeOrigin: false },
    },
  },
  preview: {
    proxy: {
      '^/crm/(?!leads(?:/|$)|follow-ups(?:/|$)|analytics(?:/|$)|designs(?:/|$)|login(?:/|$)).+': { target: 'http://127.0.0.1:13000', changeOrigin: false, ws: true },
      '/prospect-api': { target: 'http://127.0.0.1:13010', changeOrigin: false },
    },
  },
  plugins: [react(), {
    name: 'sixsummit-shared-origin',
    configureServer: sharedOriginRoutes,
    configurePreviewServer: sharedOriginRoutes,
  }],
})
