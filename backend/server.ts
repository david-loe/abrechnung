import app from './app.js'
import { User as IUser } from '../common/types.js'
import { HydratedDocument } from 'mongoose'
const port = parseInt(process.env.BACKEND_PORT)
const url = process.env.VITE_BACKEND_URL

declare global {
  namespace Express {
    interface User extends HydratedDocument<IUser> {}
  }
  namespace NodeJS {
    interface ProcessEnv {
      readonly NODE_ENV: 'development' | 'production'
      readonly FIXER_API_KEY: string
      readonly ADMIN_UID: string
      readonly VITE_FRONTEND_URL: string
      readonly VITE_BACKEND_URL: string
      readonly COOKIE_SECRET: string
      readonly VITE_AUTH_USE_MS_AZURE: 'TRUE' | 'FALSE'
      readonly VITE_AUTH_USE_LDAP: 'TRUE' | 'FALSE'
      readonly VITE_AUTH_USE_MAGIC_LOGIN: 'TRUE' | 'FALSE'
      readonly MAGIC_LOGIN_SECRET: string
      readonly MS_AZURE_CLIENT_ID: string
      readonly MS_AZURE_CLIENT_SECRET: string
      readonly MS_AZURE_TENANT: string
      readonly LDAP_URL: string
      readonly LDAP_BINDDN: string
      readonly LDAP_BINDCREDENTIALS: string
      readonly LDAP_SEARCHBASE: string
      readonly LDAP_SEARCHFILTER: string
      readonly LDAP_TLS_REQUESTCERT: 'TRUE' | 'FALSE'
      readonly LDAP_TLS_REJECTUNAUTHORIZED: 'TRUE' | 'FALSE'
      readonly LDAP_MAIL_ATTRIBUTE: string
      readonly LDAP_UID_ATTRIBUTE: string
      readonly LDAP_SURNAME_ATTRIBUTE: string
      readonly LDAP_GIVENNAME_ATTRIBUTE: string
      readonly SMTP_HOST: string
      readonly SMTP_PORT: string
      readonly SMTP_SECURE: 'TRUE' | 'FALSE'
      readonly SMTP_USER: string
      readonly SMTP_PASS: string
      readonly MAIL_SENDER_ADDRESS: string
      readonly BACKEND_PORT: string
      readonly MONGO_URL: string
      readonly VITE_I18N_LOCALE: string
      readonly VITE_I18N_FALLBACK_LOCALE: string
      readonly BACKEND_SAVE_REPORTS_ON_DISK: 'TRUE' | 'FALSE'
    }
  }
}

app.listen(port, () => {
  console.log(`Backend listening at ${url}`)
})
