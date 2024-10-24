import { HydratedDocument, model, Schema } from 'mongoose'
import { emailRegex, SystemSettings } from '../../common/types.js'
import ldapauth from '../authStrategies/ldapauth.js'
import microsoft from '../authStrategies/microsoft.js'
import mail from '../mail/client.js'

export const systemSettingsSchema = new Schema<SystemSettings>({
  smtp: {
    type: {
      host: { type: String, trim: true, required: true, label: 'Host' },
      port: { type: Number, required: true, min: 1, max: 65535, label: 'Port' },
      secure: { type: Boolean, required: true, default: true, label: 'Secure' },
      user: { type: String, trim: true, required: true },
      password: { type: String, trim: true, required: true },
      senderAddress: { type: String, trim: true, required: true, validate: emailRegex, label: 'Sender Address' }
    },
    required: true,
    label: 'SMTP'
  },
  auth: {
    type: {
      microsoft: {
        type: {
          clientId: { type: String, trim: true, label: 'Client ID' },
          clientSecret: { type: String, trim: true, label: 'Client Secret' },
          tenant: { type: String, trim: true, default: 'common', label: 'Tenant' }
        },
        label: 'Microsoft'
      },
      ldapauth: {
        type: {
          url: { type: String, trim: true, label: 'URL' },
          bindDN: { type: String, trim: true, label: 'Bind DN' },
          bindCredentials: { type: String, trim: true, label: 'Bind Credentials' },
          searchBase: { type: String, trim: true, label: 'Search Base' },
          searchFilter: { type: String, trim: true, label: 'Search Filter' },
          tlsOptions: {
            type: {
              rejectUnauthorized: { type: Boolean, default: true, label: 'Reject Unauthorized' }
            },
            label: 'TLS Options'
          },
          mailAttribute: { type: String, trim: true, default: 'mail', label: 'Mail Attribute' },
          uidAttribute: { type: String, trim: true, default: 'uid', label: 'UID Attribute' },
          familyNameAttribute: { type: String, trim: true, default: 'sn', label: 'Family Name Attribute' },
          givenNameAttribute: { type: String, trim: true, default: 'givenName', label: 'Given Name Attribute' }
        },
        label: 'LDAP'
      }
    },
    required: true
  }
})

systemSettingsSchema.pre('validate', async function (this: HydratedDocument<SystemSettings>, next) {
  if (this.auth.ldapauth?.url) {
    await ldapauth.verifyConfig(this.auth.ldapauth)
  }
  await mail.verifyConfig(this.smtp)
  next()
})

systemSettingsSchema.post('save', function (this: HydratedDocument<SystemSettings>) {
  applySystemSettings(this)
})

export function applySystemSettings(systemSettings: SystemSettings) {
  mail.configureClient(systemSettings.smtp)
  if (systemSettings.auth.ldapauth?.url) {
    ldapauth.configureStrategy(systemSettings.auth.ldapauth)
  }
  if (systemSettings.auth.microsoft?.clientId) {
    microsoft.configureStrategy(systemSettings.auth.microsoft)
  }
}

export default model<SystemSettings>('SystemSettings', systemSettingsSchema)
