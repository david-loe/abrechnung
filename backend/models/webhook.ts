import { anyStates, reportTypes, Webhook, webhookMethods } from 'abrechnung-common/types.js'
import { model, Schema, Types } from 'mongoose'

export const webhookSchema = () =>
  new Schema<Webhook<Types.ObjectId>>({
    reportType: { type: [{ type: String, enum: reportTypes, required: true }], required: true },
    onState: { type: [{ type: Number, enum: Array.from(anyStates), required: true }], required: true },
    script: { type: String },
    request: {
      type: {
        url: { type: String, required: true },
        headers: { type: Schema.Types.Mixed, required: true, default: () => ({}) },
        method: { type: String, enum: webhookMethods, required: true },
        pdfFormFieldName: { type: String },
        data: { type: Schema.Types.Mixed }
      },
      required: true
    }
  })

const schema = webhookSchema()

export default model<Webhook<Types.ObjectId>>('Webhook', schema)
