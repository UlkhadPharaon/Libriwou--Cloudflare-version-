import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          maximumFileSizeToCacheInBytes: 5000000,
          // Phase 6.2 — keep the install payload small on mobile.
          // `pdf-tools` (pdfjs + mammoth) and `charts` (recharts) are only needed on
          // the documents / scan / dashboard screens, so they are cached on first USE
          // instead of blocking every visitor's service-worker install.
          globIgnores: ['**/pdf-tools-*.js', '**/charts-*.js', '**/pdf.worker-*.mjs'],
          globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
          navigateFallback: 'index.html',
          runtimeCaching: [
            {
              // Same-origin JS/CSS (including the lazily split chunks).
              urlPattern: ({ url, sameOrigin }) => sameOrigin && /\.(?:js|mjs|css)$/.test(url.pathname),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'libriwouo-assets',
                expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              // PNG/SVG/WOFF2 — immutable, cache-first.
              urlPattern: ({ url, sameOrigin }) => sameOrigin && /\.(?:png|svg|jpg|jpeg|webp|woff2?)$/.test(url.pathname),
              handler: 'CacheFirst',
              options: {
                cacheName: 'libriwouo-static',
                expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
        includeAssets: ['favicon.png', 'logo-main.png', 'mascotte.png'],
        devOptions: {
          enabled: true
        },
        manifest: {
          name: 'Libriwouô',
          short_name: 'Libriwouô',
          description: 'Business Intelligence pour le Burkina Faso et l\'UEMOA',
          theme_color: '#10b981',
          background_color: '#020617',
          icons: [
            {
               src: 'logo-main.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'logo-main.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    // Phase 6.2 — split heavy, rarely-needed deps out of the entry chunk.
    // Before: pdfjs-dist + mammoth + recharts were in the single 3.7 MB entry
    // bundle, so every page (even the landing page) had to parse them.
    // After: the entry chunk only carries the app shell; heavy libs load in parallel
    // and are cached independently across deploys.
    // NOTE: the Firebase SDK (779 KB) was removed entirely along with Firebase.
    build: {
      chunkSizeWarningLimit: 1500,
      // Phase 6.2 — Vite emits <link rel="modulepreload"> for every chunk reachable
      // from the entry, including the lazily-imported route chunks. That made the
      // landing page preload recharts (407 KB) even though only /dashboard needs it.
      // Keep the useful preloads, drop the heavy deferred ones: they are fetched for
      // real when the user navigates to the route that needs them.
      modulePreload: {
        resolveDependencies: (_filename, deps) =>
          deps.filter((d) => !d.includes('charts-') && !d.includes('pdf-tools-') && !d.includes('pdf.worker')),
      },
      rollupOptions: {
        output: {
          // NOTE: an explicit `charts`/`pdf-tools` manualChunks entry was removed.
          // Forcing those chunks made Rollup emit a *static* import from the entry
          // chunk back into the charts chunk (shared symbols), which pulled 407 KB
          // of recharts into every page load. Vite's automatic per-route splitting
          // keeps the boundary clean, so the entry never reaches into them.
          manualChunks: (id) => {
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/react-router') ||
              id.includes('node_modules/scheduler')
            ) {
              return 'react-vendor';
            }
            return undefined;
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    // Vitest (Phase 2.2 / 5.1) — unit tests for the pure logic modules.
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
