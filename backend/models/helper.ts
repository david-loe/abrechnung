import { Schema } from 'mongoose'
import { AnyState } from '../../common/types.js'

export function costObject(
  exchangeRate = true,
  receipts = true,
  required = false,
  defaultCurrency: string | null = null,
  defaultAmount: number | null = null,
  min: number | null = 0
) {
  const type: any = {
    amount: { type: Number, min, required: required, default: defaultAmount }
  }
  if (exchangeRate) {
    type.exchangeRate = {
      date: { type: Date },
      rate: { type: Number, min: 0 },
      amount: { type: Number, min }
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
  const log: { type: { [key in T]?: typeof logEntry }; required: true; default: () => {} } = {
    type: {},
    required: true,
    default: () => ({})
  }
  for (const state of states) {
    log.type[state] = logEntry
  }
  return log
}
