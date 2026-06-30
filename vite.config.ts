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
      // Proxy Zoho CRM API calls to bypass CORS in local dev
      '/zoho-crm-proxy': {
        target: 'https://www.zohoapis.in',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/zoho-crm-proxy/, ''),
        secure: true,
      },
      // Proxy Zoho Accounts API calls to bypass CORS in local dev
      '/zoho-accounts-proxy': {
        target: 'https://accounts.zoho.in',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/zoho-accounts-proxy/, ''),
        secure: true,
      },
      // Proxy portal CRM API calls (portal tokens only work through the portal domain)
      '/portal-crm-proxy': {
        target: 'https://launchpad.zcrmportals.in',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/portal-crm-proxy/, ''),
        secure: true,
      },
    },
  },
})
