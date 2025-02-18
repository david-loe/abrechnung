import pdf_lib from 'pdf-lib'
import { _id } from '../common/types.js'
import { getSettings } from './db.js'
import { formatter } from './i18n.js'
import DocumentFile from './models/documentFile.js'
import Organisation from './models/organisation.js'
import { ReportPrinter } from './pdf/printer.js'

export const reportPrinter = new ReportPrinter(
  {
    fontName: 'NotoSans',
    fontSizes: { S: 9, M: 11, L: 16 },
    textColor: pdf_lib.rgb(0, 0, 0),
    pagePadding: 36,
    borderColor: pdf_lib.rgb(0, 0, 0),
    borderThickness: 1,
    cellPadding: { x: 2, bottom: 4 },
    pageSize: pdf_lib.PageSizes.A4
  },
  formatter,
  (await getSettings()).travelSettings.distanceRefunds,
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
