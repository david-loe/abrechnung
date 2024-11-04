import { model, Schema } from 'mongoose'
import { DisplaySettings, Locale, locales } from '../../common/types.js'

const overwrites = {} as { [key in Locale]: { type: typeof Schema.Types.Mixed; required: true; default: () => object } }
for (const locale of locales) {
  overwrites[locale] = { type: Schema.Types.Mixed, required: true, default: () => ({}) }
}

function defaultOverwrite() {
  const obj: Partial<DisplaySettings['locale']['overwrite']> = {}
  for (const locale of locales) {
    obj[locale] = {}
  }
  return obj as DisplaySettings['locale']['overwrite']
}

export const displaySettingsSchema = new Schema<DisplaySettings>(
  {
    auth: {
      type: {
        magiclogin: { type: Boolean, required: true, label: 'Magiclogin' },
        microsoft: { type: Boolean, required: true, label: 'Microsoft' },
        ldapauth: { type: Boolean, required: true, label: 'LDAP' }
      },
      required: true
    },
    locale: {
      type: {
        default: { type: String, enum: locales, required: true },
        fallback: { type: String, enum: locales, required: true },
        overwrite: { type: overwrites, required: true, description: 'description.keyFullIdentifier' }
      },
      required: true,
      label: 'Sprache'
    }
  },
  { minimize: false, toObject: { minimize: false }, toJSON: { minimize: false } }
)

export default model<DisplaySettings>('DisplaySettings', displaySettingsSchema)
