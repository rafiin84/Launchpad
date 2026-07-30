import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  server: {
    proxy: {
      // App backend (profile-photo endpoint) — not a Zoho API call.
      '/api': {
        target: 'https://launchpad-iota-ten.vercel.app',
        changeOrigin: true,
        secure: true,
      },
      // No Zoho proxies — all Zoho CRM / portal API calls go direct from the
      // browser using the user's own OAuth token. The app origin must be added
      // to Zoho's allowed/trusted domains (CORS) for the browser to permit them.
    },
  },
})
