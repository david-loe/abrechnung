import { HydratedDocument, model, Schema, Types } from 'mongoose'
import { ConnectionSettings, defaultLocale, emailRegex, locales } from '../../common/types.js'
import ENV from '../env.js'
import { verifyLdapauthConfig, verifySmtpConfig } from '../settingsValidator.js'

function requiredIf(ifPath: string) {
  return [{ required: [ifPath, 'not_in', [null, '', false]] }, { nullable: [ifPath, 'in', [null, '', false]] }]
}

export const connectionSettingsSchema = () =>
  new Schema<ConnectionSettings<Types.ObjectId>>({
    PDFReportsViaEmail: {
      type: {
        sendPDFReportsToOrganisationEmail: { type: Boolean, default: false, required: true },
        locale: { type: String, enum: locales, required: true, default: defaultLocale }
      },
      required: true,
      default: () => ({}),
      label: 'PDF via Email'
    },
    smtp: {
      type: {
        host: { type: String, trim: true, required: true, label: 'Host', rules: requiredIf('smtp.user') },
        port: { type: Number, required: true, min: 1, max: 65535, label: 'Port', rules: requiredIf('smtp.host') },
        secure: { type: Boolean, default: true, required: true, label: 'Secure' },
        user: { type: String, trim: true, required: true, rules: requiredIf('smtp.host') },
        password: { type: String, trim: true, required: true, rules: requiredIf('smtp.host') },
        senderAddress: {
          type: String,
          trim: true,
          required: true,
          validate: emailRegex,
          label: 'Sender Address',
          rules: requiredIf('smtp.host')
        }
      },
      label: 'SMTP'
    },
    auth: {
      type: {
        microsoft: {
          type: {
            clientId: { type: String, trim: true, required: true, label: 'Client ID', rules: requiredIf('auth.microsoft.clientSecret') },
            clientSecret: {
              type: String,
              trim: true,
              required: true,
              label: 'Client Secret',
              rules: requiredIf('auth.microsoft.clientId')
            },
            tenant: {
              type: String,
              trim: true,
              required: true,
              default: 'common',
              label: 'Tenant',
              rules: requiredIf('auth.microsoft.clientId')
            }
          },
          label: 'Microsoft',
          description: `https://portal.azure.com > Azure Active Directory > App registration - Callback URL: ${ENV.VITE_BACKEND_URL}/auth/microsoft/callback`
        },
        ldapauth: {
          type: {
            url: { type: String, trim: true, required: true, label: 'URL', rules: requiredIf('auth.ldapauth.bindDN') },
            bindDN: { type: String, trim: true, required: true, label: 'Bind DN', rules: requiredIf('auth.ldapauth.url') },
            bindCredentials: {
              type: String,
              trim: true,
              required: true,
              label: 'Bind Credentials',
              rules: requiredIf('auth.ldapauth.url')
            },
            searchBase: { type: String, trim: true, required: true, label: 'Search Base', rules: requiredIf('auth.ldapauth.url') },
            searchFilter: { type: String, trim: true, required: true, label: 'Search Filter', rules: requiredIf('auth.ldapauth.url') },
            tlsOptions: {
              type: { rejectUnauthorized: { type: Boolean, default: true, label: 'Reject Unauthorized' } },
              required: true,
              label: 'TLS Options'
            },
            mailAttribute: {
              type: String,
              trim: true,
              required: true,
              default: 'mail',
              label: 'Mail Attribute',
              rules: requiredIf('auth.ldapauth.url')
            },
            uidAttribute: {
              type: String,
              trim: true,
              required: true,
              default: 'uid',
              label: 'UID Attribute',
              rules: requiredIf('auth.ldapauth.url')
            },
            familyNameAttribute: {
              type: String,
              trim: true,
              required: true,
              default: 'sn',
              label: 'Family Name Attribute',
              rules: requiredIf('auth.ldapauth.url')
            },
            givenNameAttribute: {
              type: String,
              trim: true,
              required: true,
              default: 'givenName',
              label: 'Given Name Attribute',
              rules: requiredIf('auth.ldapauth.url')
            }
          },
          label: 'LDAP'
        },
        oidc: {
          type: {
            server: { type: String, trim: true, required: true, label: 'Server', rules: requiredIf('auth.oidc.clientId') },
            clientId: { type: String, trim: true, required: true, label: 'Client ID', rules: requiredIf('auth.oidc.server') },
            clientSecret: { type: String, trim: true, required: true, label: 'Client Secret', rules: requiredIf('auth.oidc.server') }
          },
          label: 'OIDC',
          description: `scope: 'openid email profile' - Callback URL: ${ENV.VITE_BACKEND_URL}/auth/oidc/callback`
        }
      },

      required: true,
      default: () => ({})
    }
  })

const schema = connectionSettingsSchema()

schema.pre('validate', async function (this: HydratedDocument<ConnectionSettings<Types.ObjectId>>) {
  if (this.auth.ldapauth?.url) {
    await verifyLdapauthConfig(this.auth.ldapauth)
  }
  if (this.smtp?.host) {
    await verifySmtpConfig(this.smtp)
  }
})

export default model<ConnectionSettings<Types.ObjectId>>('ConnectionSettings', schema)
