import { CronJob } from 'cron'
import { Locale, locales } from '../common/types.js'
import app from './app.js'
import { fetchAndUpdateLumpSums } from './db.js'
import { countrySchema } from './models/country.js'
import { currencySchema } from './models/currency.js'
import { healthInsuranceSchema } from './models/healthInsurance.js'
import { organisationSchema } from './models/organisation.js'
import { projectSchema, projectUsersSchema } from './models/project.js'
import { settingsSchema } from './models/settings.js'
import { UserDoc, userSchema } from './models/user.js'
import { generateForms } from './models/vueformGenerator.js'
import { retentionPolicy } from './retentionpolicy.js'
const port = parseInt(process.env.BACKEND_PORT)
const url = process.env.VITE_BACKEND_URL

declare global {
  namespace Express {
    interface User extends UserDoc {}
    interface AuthInfo {
      redirect?: string
    }
  }
  namespace NodeJS {
    interface ProcessEnv {
      readonly NODE_ENV: 'development' | 'production'
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
      readonly VITE_I18N_LOCALE: Locale
      readonly VITE_I18N_FALLBACK_LOCALE: Locale
      readonly VITE_I18N_LOCALES_OVERWRITE: string
      readonly BACKEND_SAVE_REPORTS_ON_DISK: 'TRUE' | 'FALSE'
    }
  }
}

if (process.env.NODE_ENV === 'development') {
  generateForms(
    {
      user: userSchema.obj,
      country: countrySchema.obj,
      currency: currencySchema.obj,
      project: Object.assign(projectSchema.obj, projectUsersSchema.obj),
      healthInsurance: healthInsuranceSchema.obj,
      organisation: organisationSchema.obj,
      settings: settingsSchema.obj
    },
    locales,
    '../common/forms'
  )
}

app.listen(port, () => {
  console.log(`Backend listening at ${url}`)
})

// Update lump sums every day at 1 AM
CronJob.from({ cronTime: '0 1 * * *', onTick: fetchAndUpdateLumpSums, start: true })
// Trigger automatic deletion and notification mails for upcoming deletions every day at 1 AM
CronJob.from({ cronTime: '0 1 * * *', onTick: retentionPolicy, start: true })
