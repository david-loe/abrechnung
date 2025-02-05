interface ImportMetaEnv {
  readonly VITE_PUBLIC_VAPID_KEY: string
  readonly VITE_BACKEND_URL: string
  readonly VITE_FRONTEND_URL: string
  readonly MODE: 'development' | 'production'
  readonly VITE_MAX_FILE_SIZE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
