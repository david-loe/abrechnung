import { model, Schema } from 'mongoose'

const schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  credentialId: { type: String, required: true, unique: true },
  publicKey: { type: String, required: true },
  counter: { type: Number, required: true },
  transports: { type: [String], required: true },
  deviceType: { type: String, required: true },
  backedUp: { type: Boolean, required: true },
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
  createdAt: { type: Date, required: true, default: Date.now },
  lastUsedAt: { type: Date }
})

export default model('Passkey', schema)
