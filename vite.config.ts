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
      // .com proxies MUST come before .in proxies (longer prefix first)
      '/zoho-crm-proxy-com': {
        target: 'https://www.zohoapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/zoho-crm-proxy-com/, ''),
        secure: true,
      },
      '/zoho-crm-proxy': {
        target: 'https://www.zohoapis.in',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/zoho-crm-proxy/, ''),
        secure: true,
      },
      '/zoho-accounts-proxy-com': {
        target: 'https://accounts.zoho.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/zoho-accounts-proxy-com/, ''),
        secure: true,
      },
      '/zoho-accounts-proxy': {
        target: 'https://accounts.zoho.in',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/zoho-accounts-proxy/, ''),
        secure: true,
      },
    },
  },
})
