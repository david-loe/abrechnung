import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default {
  plugins: [
    vue(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: '',
      filename: 'sw.ts',
      injectRegister: false,
      manifest: false,
      injectManifest: {
        maximumFileSizeToCacheInBytes: 4000000
      }
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
