import { Schema, model } from 'mongoose'
import { LedgerAccount } from '../../common/types.js'

export const ledgerAccountSchema = () =>
  new Schema<LedgerAccount>({
    identifier: { type: String, trim: true, required: true, unique: true, index: true },
    name: { type: String, trim: true }
  })

const schema = ledgerAccountSchema()

export default model<LedgerAccount>('LedgerAccount', schema)
