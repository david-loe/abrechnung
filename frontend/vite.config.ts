import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default {
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: '',
      filename: 'sw.ts',
      injectRegister: false,
      manifest: false,
      devOptions: {
        enabled: true,
        navigateFallback: 'index.html',
        type: 'module'
      },
      injectManifest: {
        maximumFileSizeToCacheInBytes: 4000000
      }
    })
  ],
  server: { port: 80, strictPort: true, host: '0.0.0.0', allowedHosts: [process.env.VITE_FRONTEND_URL!.replace(/^https?:\/\//, '')] },
  preview: { port: 80, host: '0.0.0.0' },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
}
