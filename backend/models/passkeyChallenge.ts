import { model, Schema } from 'mongoose'

const schema = new Schema({
  session: { type: String, required: true },
  purpose: { type: String, enum: ['registration', 'authentication'], required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  challenge: { type: String, required: true },
  expiresAt: { type: Date, required: true, expires: 0 }
})

export default model('PasskeyChallenge', schema)
