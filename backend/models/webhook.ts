import { inspect } from 'node:util'
import { anyStates, reportTypes, State, Webhook, webhookMethods } from 'abrechnung-common/types.js'
import { model, Schema, Types } from 'mongoose'

export const webhookSchema = () =>
  new Schema<Webhook<Types.ObjectId>>(
    {
      name: { type: String, required: true },
      executionOrder: { type: Number, required: true, min: 1, max: 2_097_152 }, // https://docs.bullmq.io/guide/jobs/prioritized
      reportType: { type: [{ type: String, enum: reportTypes, required: true }], required: true },
      onState: { type: [{ type: Number, enum: Array.from(anyStates), required: true }], required: true, description: inspect(State) },
      isActive: { type: Boolean, required: true, default: true },
      request: {
        type: {
          url: { type: String, required: true, label: 'URL' },
          method: { type: String, enum: webhookMethods, required: true, translationPrefix: '' },
          headers: { type: Schema.Types.Mixed, required: true, default: () => ({}), label: 'Header' },
          body: { type: Schema.Types.Mixed, label: 'Body' },
          convertBodyToFormData: { type: Boolean, required: true, default: false },
          pdfFormFieldName: { type: String, conditions: [['request.convertBodyToFormData', true]] }
        },
        required: true,
        label: 'Request'
      },
      script: { type: String, specialType: 'code', noColumn: true }
    },
    { minimize: false, toObject: { minimize: false }, toJSON: { minimize: false } }
  )

const schema = webhookSchema()

export default model<Webhook<Types.ObjectId>>('Webhook', schema)
