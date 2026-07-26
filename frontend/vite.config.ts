import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig, searchForWorkspaceRoot } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

function chunkName(moduleId: string) {
  // Route metadata is intentionally part of the tiny application shell; putting
  // it into the admin chunk would make every route import the whole admin graph.
  if (moduleId.endsWith('/components/settings/adminSections.ts')) return
  if (
    moduleId.includes('/components/settings/') ||
    moduleId.includes('/components/elements/vueform/') ||
    moduleId.includes('/vueform.config.') ||
    /\/node_modules\/(?:@vueform|@codemirror|@lezer|json-editor-vue|simple-code-editor|vanilla-picker)\//.test(moduleId)
  )
    return 'admin'
  if (moduleId.includes('/components/travel/')) return 'travel'
  if (moduleId.includes('/components/expenseReport/')) return 'expense-report'
  if (moduleId.includes('/components/healthCareCost/')) return 'health-care-cost'
  if (moduleId.includes('/components/advance/')) return 'advance'
  if (moduleId.endsWith('/components/HomePage.vue')) return 'user'
  if (moduleId.endsWith('/components/LoginPage.vue')) return 'login'
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
        maximumFileSizeToCacheInBytes: 5_000_000,
        manifestTransforms: [
          (manifest) => ({
            manifest: manifest.filter(({ url }) => {
              if (url === 'index.html' || url === 'manifest.json') return true
              if (!url.endsWith('.js') && !url.endsWith('.css')) return false
              const filename = url.split('/').at(-1) ?? url
              return (
                !filename.startsWith('admin-') &&
                !filename.startsWith('AdminSettingsSection-') &&
                !filename.startsWith('vueform.config-') &&
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
        chunkFileNames: 'assets/[name]-[hash].js',
        codeSplitting: { includeDependenciesRecursively: false, groups: [{ name: chunkName, minSize: 0 }] }
      }
    }
  }
})
