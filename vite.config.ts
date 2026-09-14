import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Gimnasio y Nutrición',
        short_name: 'GYM',
        description: 'Registro personal de comidas, entrenamiento y progreso',
        lang: 'es',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0B0F14',
        theme_color: '#0B0F14',
        // Destino de la hoja de compartir del sistema. Safari no lo soporta
        // —para iPhone se usa un Atajo que abre la app con el JSON en el
        // fragmento—, pero declararlo no cuesta nada: funciona ya en Android y
        // el día que Safari lo implemente empieza a funcionar solo.
        share_target: {
          action: '/comida/importar',
          method: 'GET',
          // Con GET el texto llega en la cadena de consulta, que sí viaja al
          // servidor. El Atajo usa el fragmento, que no.
          params: { text: 'json', title: 'titulo', url: 'json' },
        },
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // El shell se sirve desde caché; los datos van por IndexedDB, no por el SW.
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        // Permite probar la instalación y el service worker con `npm run dev`.
        enabled: true,
        type: 'module',
      },
    }),
  ],
})
