import { Schema, model } from 'mongoose'
import { Organisation } from '../../common/types.js'

const organisationSchema = new Schema<Organisation>({
  name: { type: String, trim: true, required: true },
  subfolderPath: { type: String, trim: true, default: '' },
  bankDetails: { type: String },
  companyNumber: { type: String, trim: true }
})

export default model<Organisation>('Organisation', organisationSchema)
