import { ReportPrinter } from '../common/print/printer.js'
import { _id, Locale } from '../common/types.js'
import { getSettings } from './db.js'
import i18n, { formatter } from './i18n.js'
import DocumentFile from './models/documentFile.js'
import Organisation from './models/organisation.js'

export const reportPrinter = new ReportPrinter(
  (await getSettings()).travelSettings.distanceRefunds,
  formatter,
  (textIdentifier: string, language: Locale, interpolation?: any) => {
    return i18n.t(textIdentifier, { lng: language, ...interpolation }) as string
  },
  async (id: _id) => {
    const doc = await DocumentFile.findOne({ _id: id }).lean()
    if (doc) {
      return { buffer: doc.data.buffer, type: doc.type }
    }
    return null
  },
  async (id: _id) => {
    const orga = await Organisation.findOne({ _id: id }).lean()
    if (orga?.logo?._id) {
      return { logoId: orga.logo._id, website: orga.website }
    }
    return null
  }
)
