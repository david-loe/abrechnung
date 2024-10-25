import { HydratedDocument, model, Schema } from 'mongoose'
import { ConnectionSettings, emailRegex } from '../../common/types.js'
import ldapauth from '../authStrategies/ldapauth.js'
import microsoft from '../authStrategies/microsoft.js'
import mail from '../mail/client.js'

export const connectionSettingsSchema = new Schema<ConnectionSettings>({
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
        label: 'Microsoft',
        description: `https://portal.azure.com > Azure Active Directory > App registration - Callback URL: ${process.env.VITE_BACKEND_URL}/auth/microsoft/callback`
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

connectionSettingsSchema.pre('validate', async function (this: HydratedDocument<ConnectionSettings>, next) {
  if (this.auth.ldapauth?.url) {
    await ldapauth.verifyConfig(this.auth.ldapauth)
  }
  await mail.verifyConfig(this.smtp)
  next()
})

connectionSettingsSchema.post('save', function (this: HydratedDocument<ConnectionSettings>) {
  applyConnectionSettings(this)
})

export function applyConnectionSettings(connectionSettings: ConnectionSettings) {
  mail.configureClient(connectionSettings.smtp)
  if (connectionSettings.auth.ldapauth?.url) {
    ldapauth.configureStrategy(connectionSettings.auth.ldapauth)
  }
  if (connectionSettings.auth.microsoft?.clientId) {
    microsoft.configureStrategy(connectionSettings.auth.microsoft)
  }
}

export default model<ConnectionSettings>('ConnectionSettings', connectionSettingsSchema)
