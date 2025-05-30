import { Schema, model } from 'mongoose'
import { Booking, bookingStates, reportModelNames } from '../../common/types.js'

export const bookingSchema = () =>
  new Schema<Booking>({
    state: { type: String, enum: bookingStates, required: true, default: 'open' },
    ledgerAccount: { type: Schema.Types.ObjectId, ref: 'LedgerAccount', required: true },
    report: { type: Schema.Types.ObjectId, refPath: 'reportType', required: true },
    reportType: { type: String, enum: reportModelNames, required: true },
    amount: { type: Number, min: 0, required: true },
    date: { type: Date, required: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    employee: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    remark: { type: String, trim: true }
  })

const schema = bookingSchema()

export default model<Booking>('Booking', schema)
