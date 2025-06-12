import { model, Schema } from 'mongoose'
import { emailRegex, HealthInsurance } from '../../common/types.js'

export const healthInsuranceSchema = () =>
  new Schema<HealthInsurance>({
    name: { type: String, trim: true, required: true },
    email: { type: String, trim: true, required: true, validate: emailRegex }
  })

export default model<HealthInsurance>('HealthInsurance', healthInsuranceSchema())
