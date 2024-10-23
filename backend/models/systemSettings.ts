import { model, Schema } from 'mongoose'
import { emailRegex, SystemSettings } from '../../common/types.js'

export const systemSettingsSchema = new Schema<SystemSettings>({
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
          tlsRequestCert: { type: Boolean, default: true, label: 'TLS Request Cert' },
          tlsRejectUnauthorized: { type: Boolean, default: false, label: 'TLS Reject Unauthorized' },
          mailAttribute: { type: String, trim: true, default: 'mail', label: 'Mail Attribute' },
          uidAttribute: { type: String, trim: true, default: 'uid', label: 'UID Attribute' },
          familyNameAttribute: { type: String, trim: true, default: 'sn', label: 'Family Name Attribute' },
          givenNameAttribute: { type: String, trim: true, default: 'givenName', label: 'Given Name Attribute' }
        },
        label: 'LDAP'
      }
    },
    required: true
  },
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
  }
})

export default model<SystemSettings>('SystemSettings', systemSettingsSchema)
