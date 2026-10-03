import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Served from joaquinvargas.me/fantasy-football-dashboard/ by GitHub Pages.
  // Must match the repo name, or the built app loads a blank page.
  base: '/fantasy-football-dashboard/',
})
