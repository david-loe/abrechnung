import { LedgerAccount } from 'abrechnung-common/types.js'
import { model, Schema, Types } from 'mongoose'

export const ledgerAccountSchema = () =>
  new Schema<LedgerAccount<Types.ObjectId>>({
    identifier: { type: String, trim: true, required: true, unique: true, index: true },
    name: { type: String, trim: true, required: true }
  })

const schema = ledgerAccountSchema()

export default model<LedgerAccount<Types.ObjectId>>('LedgerAccount', schema)
