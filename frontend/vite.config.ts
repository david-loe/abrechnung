import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig, searchForWorkspaceRoot } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

function chunkCategory(moduleIds: readonly string[]) {
  if (
    moduleIds.some(
      (moduleId) =>
        moduleId.includes('/components/settings/') ||
        moduleId.includes('/components/elements/vueform/') ||
        moduleId.includes('/vueform.config.') ||
        /\/node_modules\/(?:@vueform|@codemirror|@lezer|json-editor-vue|simple-code-editor|vanilla-picker)\//.test(moduleId)
    )
  )
    return 'admin'
  if (moduleIds.some((moduleId) => moduleId.includes('/components/travel/'))) return 'travel'
  if (moduleIds.some((moduleId) => moduleId.includes('/components/expenseReport/'))) return 'expense-report'
  if (moduleIds.some((moduleId) => moduleId.includes('/components/healthCareCost/'))) return 'health-care-cost'
  if (moduleIds.some((moduleId) => moduleId.includes('/components/advance/'))) return 'advance'
  if (moduleIds.some((moduleId) => moduleId.endsWith('/components/HomePage.vue'))) return 'user'
  if (moduleIds.some((moduleId) => moduleId.endsWith('/components/LoginPage.vue'))) return 'login'
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: '',
      filename: 'sw.ts',
      injectRegister: false,
      manifest: false,
      devOptions: { enabled: true, navigateFallback: 'index.html', type: 'module' },
      injectManifest: {
        // Filtering happens after Workbox discovers assets, so this must also
        // accommodate excluded admin bundles.
        maximumFileSizeToCacheInBytes: 30_000_000,
        manifestTransforms: [
          (manifest) => ({
            manifest: manifest.filter(({ url }) => {
              if (url === 'index.html' || url === 'manifest.json') return true
              if (!url.endsWith('.js') && !url.endsWith('.css')) return false
              const filename = url.split('/').at(-1) ?? url
              return (
                !filename.startsWith('receiptOcr-') &&
                !filename.startsWith('worker-entry-') &&
                !filename.startsWith('ort-wasm-') &&
                !filename.startsWith('pdf.worker-') &&
                !filename.startsWith('admin-') &&
                !filename.startsWith('AdminSettingsSection-') &&
                !filename.startsWith('SettingsPage-') &&
                !filename.startsWith('vueform.config-') &&
                !filename.startsWith('vueform-') &&
                !filename.startsWith('vanilla-picker-')
              )
            })
          })
        ]
      }
    })
  ],
  server: {
    port: 8080,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: [process.env.VITE_FRONTEND_URL?.replace(/^https?:\/\//, '')].filter((host): host is string => Boolean(host)),
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), '../common'] }
  },
  preview: { port: 8080, host: '0.0.0.0' },
  resolve: { alias: { '@': resolve(__dirname, './src') } },
  build: {
    manifest: true,
    rollupOptions: {
      output: {
        entryFileNames: 'app-[hash].js',
        // Keep human-readable bundle categories without forcing modules into
        // manual groups, which can introduce cycles between lazy route entries.
        chunkFileNames: (chunk) => {
          const category = chunk.facadeModuleId ? chunkCategory([chunk.facadeModuleId]) : chunkCategory(chunk.moduleIds)
          return `assets/${category ?? '[name]'}-[hash].js`
        }
      }
    }
  }
})
