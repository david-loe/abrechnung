import mongoose from 'mongoose'

const fileSchema = new mongoose.Schema({
  data: { type: Buffer },
  type: { type: String, enum: ['image/jpeg', 'image/png', 'application/pdf'] },
  name: { type: String },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
})

export default mongoose.model('DocumentFile', fileSchema)
