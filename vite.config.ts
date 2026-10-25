import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Injects the CSP meta tag (REQ-UX1) with the real Supabase project URL when
 * configured, and a safe self-only policy when it is not — so the built HTML
 * never contains an invalid `%VAR%` token.
 */
function cspMeta(): Plugin {
  let mode = 'production'
  let envDir = process.cwd()
  const sources = ['self']
  return {
    name: 'csp-meta',
    configResolved(config) {
      mode = config.mode
      envDir = config.envDir ?? process.cwd()
      // honour process-level env too (CI)
      const fromProcess = process.env.VITE_SUPABASE_URL
      if (fromProcess?.startsWith('https://') && !sources.includes(fromProcess)) {
        sources.push(fromProcess, 'wss://*.supabase.co')
      }
    },
    transformIndexHtml(html) {
      // loadEnv so .env/.env.local are honoured (Vite doesn't expose them on process.env)
      const env = loadEnv(mode, envDir, 'VITE_')
      const url = env.VITE_SUPABASE_URL
      if (url?.startsWith('https://') && !sources.includes(url)) {
        sources.push(url, 'wss://*.supabase.co')
      }
      const csp = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        `connect-src ${sources.join(' ')}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ')
      return html.includes('http-equiv="Content-Security-Policy"')
        ? html.replace(/connect-src [^;"]*/, `connect-src ${sources.join(' ')}`)
        : html.replace(
            /<meta\s+name="viewport"[^>]*\/>/,
            (m) => `${m}\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`,
          )
    },
  }
}

export default defineConfig({
  plugins: [react(), cspMeta()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          pdf: ['jspdf'],
        },
      },
    },
  },
})
