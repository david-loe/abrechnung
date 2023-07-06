import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
const path = require("path");

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {port: 80, strictPort: true, host: '0.0.0.0'},
  preview:{port:80, host: '0.0.0.0'}, 
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})


