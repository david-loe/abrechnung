interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
  readonly VITE_I18N_LOCALE: import('../../common/types').Locale
  readonly VITE_I18N_FALLBACK_LOCALE: import('../../common/types').Locale
  readonly VITE_I18N_LOCALES_OVERWRITE: string
  readonly VITE_BACKEND_URL: string
  readonly VITE_FRONTEND_URL: string
  readonly MODE: 'development' | 'production'
  readonly VITE_AUTH_USE_MS_AZURE: 'TRUE' | 'FALSE'
  readonly VITE_AUTH_USE_LDAP: 'TRUE' | 'FALSE'
  readonly VITE_AUTH_USE_MAGIC_LOGIN: 'TRUE' | 'FALSE'
  readonly VITE_MAX_FILE_SIZE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
