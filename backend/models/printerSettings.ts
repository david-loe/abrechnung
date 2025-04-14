import { HydratedDocument, Schema, model } from 'mongoose'
import { PrinterSettings, hexColorRegex } from '../../common/types.js'
import { reportPrinter } from '../factory.js'

export const printerSettingsSchema = new Schema<PrinterSettings>({
  fontSizes: {
    type: {
      S: { type: Number, min: 1, required: true },
      M: { type: Number, min: 1, required: true },
      L: { type: Number, min: 1, required: true }
    },
    required: true
  },
  textColor: { type: String, required: true, validate: hexColorRegex },
  pagePadding: { type: Number, min: 0, required: true },
  borderColor: { type: String, required: true, validate: hexColorRegex },
  borderThickness: { type: Number, min: 0, required: true },
  cellPadding: { x: { type: Number, min: 0, required: true }, bottom: { type: Number, min: 0, required: true } },
  pageSize: { type: { width: { type: Number, min: 0, required: true }, height: { type: Number, min: 0, required: true } }, required: true }
})

printerSettingsSchema.post('save', function (this: HydratedDocument<PrinterSettings>) {
  reportPrinter.setSettings(this)
})

export default model('PrinterSettings', printerSettingsSchema)
