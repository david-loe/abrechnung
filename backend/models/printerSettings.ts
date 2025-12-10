import { fontNames, hexColorRegex, PrinterSettings, ReportType, reportTypes } from 'abrechnung-common/types.js'
import { HydratedDocument, model, Schema, Types } from 'mongoose'
import { BACKEND_CACHE } from '../db.js'
import { reportPrinter } from '../factory.js'

export const printerSettingsSchema = () => {
  const options = {} as {
    [key in ReportType]: {
      type: {
        reviewDates: { type: BooleanConstructor; required: true }
        metaInformation: { type: BooleanConstructor; required: true }
        project: { type: BooleanConstructor; required: true }
        comments: { type: BooleanConstructor; required: true }
        notes: { type: BooleanConstructor; required: true }
      }
      required: true
    }
  }
  for (const reportType of reportTypes) {
    options[reportType] = {
      type: {
        reviewDates: { type: Boolean, required: true },
        metaInformation: { type: Boolean, required: true },
        project: { type: Boolean, required: true },
        comments: { type: Boolean, required: true },
        notes: { type: Boolean, required: true }
      },
      required: true
    }
  }
  return new Schema<PrinterSettings<Types.ObjectId>>({
    pageSize: {
      type: { width: { type: Number, min: 0, required: true }, height: { type: Number, min: 0, required: true } },
      required: true,
      description: 'in PDF-Units (72 PDF-Units ≙ 1 inch)'
    },
    fontSizes: {
      type: {
        S: { type: Number, min: 1, required: true, label: 'S' },
        M: { type: Number, min: 1, required: true, label: 'M' },
        L: { type: Number, min: 1, required: true, label: 'L' }
      },
      required: true
    },
    pagePadding: { type: Number, min: 0, required: true },
    cellPadding: {
      type: { x: { type: Number, min: 0, required: true, label: 'X' }, bottom: { type: Number, min: 0, required: true } },
      required: true
    },
    fontName: { type: String, required: true, enum: fontNames, translationPrefix: '' },
    textColor: { type: String, required: true, validate: hexColorRegex, description: 'Hex: #rrggbb / #rgb' },
    borderColor: { type: String, required: true, validate: hexColorRegex, description: 'Hex: #rrggbb / #rgb' },
    borderThickness: { type: Number, min: 0, required: true },
    options: { type: options, required: true }
  })
}

const schema = printerSettingsSchema()

schema.post('save', function (this: HydratedDocument<PrinterSettings<Types.ObjectId>>) {
  const settings = this.toObject()
  reportPrinter.setSettings(settings)
  BACKEND_CACHE.setPrinterSettings(settings)
})

export default model('PrinterSettings', schema)
