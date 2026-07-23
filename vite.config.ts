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
      '/api': {
        target: 'https://launchpad-iota-ten.vercel.app',
        changeOrigin: true,
        secure: true,
      },
      // Dev-only CORS workaround: the Zoho portal CRM domain does not send
      // Access-Control-Allow-Origin for http://localhost, so browser calls are
      // blocked. Route them through the Vite dev server (server-to-server, no
      // CORS enforcement). The user's own portal OAuth token is forwarded intact
      // in the Authorization header — no admin token or secret is involved.
      '/portal-api': {
        target: 'https://launchpad.zcrmportals.in',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/portal-api/, ''),
      },
      // Dev proxy for the standard Zoho CRM API (investor/admin token). Used by
      // crmAppUsers (profile photos) and crmFounders (Contacts). Forwards the
      // user's own Authorization header; zohoapis.in doesn't send CORS headers
      // to localhost, so calls must go through the dev server.
      '/zoho-crm-proxy': {
        target: 'https://www.zohoapis.in',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/zoho-crm-proxy/, ''),
      },
    },
  },
})
