import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default {
  plugins: [(vue as unknown as any)()],
  server: { port: 80, strictPort: true, host: '0.0.0.0' },
  preview: { port: 80, host: '0.0.0.0' },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
}
