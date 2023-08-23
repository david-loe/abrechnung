import app from './app.js'
import { User as IUser } from '../common/types.js'
const port = parseInt(process.env.BACKEND_PORT)
const url = process.env.VITE_BACKEND_URL

declare global {
  namespace Express {
    interface User extends IUser {}
  }
  namespace NodeJS {
    interface ProcessEnv {
      readonly NODE_ENV: 'development' | 'production'
      readonly ADMIN_UID: string
      readonly VITE_FRONTEND_URL: string
      readonly VITE_BACKEND_URL: string
      readonly COOKIE_SECRET: string
      readonly LDAP_URL: string
      readonly LDAP_BINDDN: string
      readonly LDAP_BINDCREDENTIALS: string
      readonly LDAP_SEARCHBASE: string
      readonly LDAP_SEARCHFILTER: string
      readonly LDAP_TLS_REQUESTCERT: 'TRUE' | 'FALSE'
      readonly LDAP_TLS_REJECTUNAUTHORIZED: 'TRUE' | 'FALSE'
      readonly LDAP_MAIL_ATTRIBUTE: string
      readonly LDAP_UID_ATTRIBUTE: string
      readonly LDAP_DISPLAYNAME_ATTRIBUTE: string
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
