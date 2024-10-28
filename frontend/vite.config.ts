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
      workbox: {
        clientsClaim: true,
        skipWaiting: true
      },
      manifest: false
    })
  ],
  server: { port: 80, strictPort: true, host: '0.0.0.0' },
  preview: { port: 80, host: '0.0.0.0' },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
}
