import {
  Access,
  AnyState,
  accesses,
  anyStates,
  DisplaySettings,
  defaultLocale,
  Locale,
  locales,
  nameDisplayFormats,
  ReportType,
  reportTypes,
  TravelState
} from 'abrechnung-common/types.js'
import { HydratedDocument, model, Schema, Types } from 'mongoose'
import { BACKEND_CACHE } from '../db.js'
import { updateI18n } from '../i18n.js'
import { colorSchema } from './helper.js'

export const displaySettingsSchema = () => {
  const overwrites = {} as { [key in Locale]: { type: typeof Schema.Types.Mixed; required: true; default: () => object; label: string } }
  for (const locale of locales) {
    overwrites[locale] = { type: Schema.Types.Mixed, required: true, default: () => ({}), label: `languages.${locale}` }
  }

  const stateColors = {} as {
    [key in AnyState]: {
      type: {
        color: { type: StringConstructor; required: boolean; validate: RegExp; description: string }
        text: { type: StringConstructor; enum: readonly string[]; required: boolean }
      }
      required: boolean
      label: string
    }
  }
  for (const state of anyStates) {
    const stateLabel = TravelState[state]
    stateColors[state] = colorSchema(`states.${stateLabel}`)
  }

  const accessIcons = {} as { [key in Access]: { type: { type: StringConstructor; required: true }[]; required: true; label: string } }
  for (const access of accesses) {
    accessIcons[access] = { type: [{ type: String, required: true }], required: true, label: `accesses.${access}` }
  }

  const reportTypeIcons = {} as { [key in ReportType]: { type: { type: StringConstructor; required: true }[]; required: true } }
  for (const reportType of reportTypes) {
    reportTypeIcons[reportType] = { type: [{ type: String, required: true }], required: true }
  }

  return new Schema<DisplaySettings<Types.ObjectId>>(
    {
      auth: {
        type: {
          magiclogin: { type: Boolean, required: true, label: 'Magiclogin', hide: !BACKEND_CACHE.connectionSettings.smtp },
          microsoft: { type: Boolean, required: true, label: 'Microsoft', hide: !BACKEND_CACHE.connectionSettings.auth.microsoft },
          ldapauth: { type: Boolean, required: true, label: 'LDAP', hide: !BACKEND_CACHE.connectionSettings.auth.ldapauth },
          oidc: { type: Boolean, required: true, label: 'OIDC', hide: !BACKEND_CACHE.connectionSettings.auth.oidc }
        },
        required: true
      },
      oidc: {
        type: {
          label: { type: String, required: true, default: 'OIDC' },
          icon: { type: String, required: true, default: 'key', label: 'Icon', description: "https://icons.getbootstrap.com/ (e.g. 'key')" }
        },
        label: 'OIDC',
        required: true,
        conditions: [['auth.oidc', true]]
      },
      locale: {
        type: {
          default: { type: String, enum: locales, required: true, default: defaultLocale, translationPrefix: 'languages.' },
          fallback: { type: String, enum: locales, required: true, default: defaultLocale, translationPrefix: 'languages.' },
          overwrite: { type: overwrites, required: true, description: 'description.keyFullIdentifier' }
        },
        required: true
      },
      nameDisplayFormat: { type: String, enum: nameDisplayFormats, required: true },
      helpButton: {
        type: {
          enabled: { type: Boolean, required: true, default: true },
          examinersMail: { type: Boolean, required: true, default: true, conditions: [['helpButton.enabled', true]] },
          examinersMsTeams: { type: Boolean, required: true, default: true, conditions: [['helpButton.enabled', true]] },
          customOptions: {
            type: [
              {
                type: {
                  label: { type: String, required: true },
                  link: { type: String, required: true },
                  icon: { type: String, required: true }
                }
              }
            ],
            conditions: [['helpButton.enabled', true]],
            description: "https://icons.getbootstrap.com/ (e.g. 'envelope')"
          }
        }
      },
      stateColors: { type: stateColors, required: true },
      accessIcons: { type: accessIcons, required: true, description: "https://icons.getbootstrap.com/ (e.g. 'airplane')" },
      reportTypeIcons: { type: reportTypeIcons, required: true, description: "https://icons.getbootstrap.com/ (e.g. 'airplane')" }
    },
    { minimize: false, toObject: { minimize: false }, toJSON: { minimize: false } }
  )
}

const schema = displaySettingsSchema()

schema.post('save', function (this: HydratedDocument<DisplaySettings<Types.ObjectId>>) {
  const settings = this.toObject()
  updateI18n(settings.locale)
  BACKEND_CACHE.setDisplaySettings(settings)
})

export default model('DisplaySettings', schema)
