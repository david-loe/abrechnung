import { Schema } from 'mongoose'
import { AnyState } from '../../common/types.js'

export function costObject(
  exchangeRate = true,
  receipts = true,
  required = false,
  defaultCurrency: string | null = null,
  defaultAmount: number | null = null
) {
  const type: any = {
    amount: { type: Number, min: 0, required: required, default: defaultAmount }
  }
  if (exchangeRate) {
    type.exchangeRate = {
      date: { type: Date },
      rate: { type: Number, min: 0 },
      amount: { type: Number, min: 0 }
    }
    type.currency = { type: String, ref: 'Currency', required: required, default: defaultCurrency }
  }
  if (receipts) {
    type.receipts = { type: [{ type: Schema.Types.ObjectId, ref: 'DocumentFile', required: required }] }
    type.date = {
      type: Date,
      validate: {
        validator: (v: Date | string | number) => new Date().valueOf() >= new Date(v).valueOf(),
        message: 'futureNotAllowed'
      },
      required: required
    }
  }
  return { type, required, default: () => ({}) }
}

export function logObject<T extends AnyState>(states: readonly T[]) {
  const logEntry = { type: { date: { type: Date, required: true }, editor: { type: Schema.Types.ObjectId, ref: 'User', required: true } } }
  const log: { type: { [key in T]?: typeof logEntry }; required: true } = { type: {}, required: true }
  for (const state of states) {
    log.type[state] = logEntry
  }
  return log
}
