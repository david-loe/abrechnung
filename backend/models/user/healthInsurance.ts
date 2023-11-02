import { Schema, model } from 'mongoose'

const healthInsuranceSchema = new Schema({
  name: { type: String, trim: true, required: true },
  mail: { type: String, trim: true, required: true }
})

export default model('HealthInsurance', healthInsuranceSchema)
