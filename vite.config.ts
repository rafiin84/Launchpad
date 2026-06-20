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
    },
  },
})
