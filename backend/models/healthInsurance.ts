import { emailRegex, HealthInsurance } from 'abrechnung-common/types.js'
import { model, Schema, Types } from 'mongoose'

export const healthInsuranceSchema = () =>
  new Schema<HealthInsurance<Types.ObjectId>>({
    name: { type: String, trim: true, required: true },
    email: { type: String, trim: true, required: true, validate: emailRegex }
  })

export default model<HealthInsurance<Types.ObjectId>>('HealthInsurance', healthInsuranceSchema())
