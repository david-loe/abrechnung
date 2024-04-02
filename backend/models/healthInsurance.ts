import { Schema, model } from 'mongoose'
import { HealthInsurance } from '../../common/types.js'

export const healthInsuranceSchema = new Schema<HealthInsurance>({
  name: { type: String, trim: true, required: true },
  email: { type: String, trim: true, required: true }
})

export default model<HealthInsurance>('HealthInsurance', healthInsuranceSchema)
