import { Schema, model } from 'mongoose'

const organisationSchema = new Schema({
  name: { type: String, trim: true, required: true },
  subfolderPath: { type: String, trim: true, default: '' }
})

export default model('Organisation', organisationSchema)
