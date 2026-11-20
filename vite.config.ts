import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'icon.svg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: '/',
          name: 'DEALKORO — Safe Gaming Account Escrow',
          short_name: 'DEALKORO',
          description:
            'Buy and sell gaming accounts safely with live price negotiation, verified admin escrow, and real-time bKash/Nagad verification.',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
      {
        name: 'disable-vite-hmr-websocket',
        apply: 'serve',
        configureServer(server) {
          server.middlewares.use('/@vite-plugin-pwa/pwa-entry-point-loaded', (_req, res) => {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
            res.end('export default function registerDevSW() {}\n');
          });
          server.middlewares.use('/@vite/client', async (_req, res, next) => {
            try {
              const result = await server.transformRequest('/@vite/client');
              if (!result) return next();
              const patched = result.code
                .replace(
                  'transport.connect(createHMRHandler(handleMessage));',
                  '/* HMR WebSocket disabled */'
                )
                .replace(
                  /throw new Error\(["']send was called before connect["']\)/g,
                  'return'
                )
                .replace(
                  /throw new Error\(["']invoke was called before connect["']\)/g,
                  'return'
                );
              res.statusCode = 200;
              res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
              res.setHeader('Cache-Control', 'no-cache');
              res.end(patched);
            } catch {
              next();
            }
          });
        },
      },
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, { recursive: true, force: true });
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,
      allowedHosts: true,
      hmr: false,
      ws: false,
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
