interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
  readonly VITE_I18N_LOCALE: import('../../common/types').Locales
  readonly VITE_I18N_FALLBACK_LOCALE: import('../../common/types').Locales
  readonly VITE_BACKEND_URL: string
  readonly VITE_FRONTEND_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
