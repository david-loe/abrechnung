import { Schema, model } from 'mongoose'
import {
  Access,
  AnyState,
  DisplaySettings,
  Locale,
  ReportType,
  accesses,
  anyStates,
  defaultLocale,
  locales,
  reportTypes
} from '../../common/types.js'
import { colorSchema } from './helper.js'

export const displaySettingsSchema = () => {
  const overwrites = {} as { [key in Locale]: { type: typeof Schema.Types.Mixed; required: true; default: () => object } }
  for (const locale of locales) {
    overwrites[locale] = { type: Schema.Types.Mixed, required: true, default: () => ({}) }
  }

  const stateColors = {} as { [key in AnyState]: ReturnType<typeof colorSchema> }
  for (const state of anyStates) {
    stateColors[state] = colorSchema(`states.${state}`)
  }

  const accessIcons = {} as { [key in Access]: { type: { type: StringConstructor; required: true }[]; required: true; label: string } }
  for (const access of accesses) {
    accessIcons[access] = { type: [{ type: String, required: true }], required: true, label: `accesses.${access}` }
  }

  const reportTypeIcons = {} as { [key in ReportType]: { type: { type: StringConstructor; required: true }[]; required: true } }
  for (const reportType of reportTypes) {
    reportTypeIcons[reportType] = { type: [{ type: String, required: true }], required: true }
  }

  return new Schema<DisplaySettings>(
    {
      auth: {
        type: {
          magiclogin: { type: Boolean, required: true, label: 'Magiclogin' },
          microsoft: { type: Boolean, required: true, label: 'Microsoft' },
          ldapauth: { type: Boolean, required: true, label: 'LDAP' },
          oidc: { type: Boolean, required: true, label: 'OIDC' }
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
          default: { type: String, enum: locales, required: true, default: defaultLocale },
          fallback: { type: String, enum: locales, required: true, default: defaultLocale },
          overwrite: { type: overwrites, required: true, description: 'description.keyFullIdentifier' }
        },
        required: true
      },
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

export default model<DisplaySettings>('DisplaySettings', displaySettingsSchema())
