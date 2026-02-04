import { Booking, reportModelNamesWithoutAdvance } from 'abrechnung-common/types.js'
import { model, Schema, Types } from 'mongoose'

export const bookingSchema = () =>
  new Schema<Booking<Types.ObjectId>>({
    ledgerAccount: { type: Schema.Types.ObjectId, ref: 'LedgerAccount', required: true },
    report: { type: Schema.Types.ObjectId, refPath: 'reportType', required: true },
    reportType: { type: String, enum: reportModelNamesWithoutAdvance, required: true },
    amount: { type: Number, min: 0, required: true },
    date: { type: Date, required: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    employee: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    remark: { type: String, trim: true }
  })

const schema = bookingSchema()

export default model<Booking<Types.ObjectId>>('Booking', schema)
