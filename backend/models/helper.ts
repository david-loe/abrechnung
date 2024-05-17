import axios from 'axios'
import { Schema } from 'mongoose'
import { ExchangeRate as ExchangeRateI, baseCurrency } from '../../common/types.js'
import ExchangeRate from './exchangeRate.js'

type InforEuroResponse = Array<{
  country: string
  currency: string
  isoA3Code: string
  isoA2Code: string
  value: number
  comment: null | string
}>

export async function convertCurrency(
  date: Date | string | number,
  amount: number,
  from: string,
  to: string = baseCurrency._id
): Promise<{ date: Date; rate: number; amount: number } | null> {
  if (from === to) {
    return null
  }
  var convertionDate = new Date(date)
  if (convertionDate.valueOf() - new Date().valueOf() > 0) {
    convertionDate = new Date()
  }
  const month = convertionDate.getUTCMonth() + 1
  const year = convertionDate.getUTCFullYear()
  var data: ExchangeRateI | null | undefined = await ExchangeRate.findOne({ currency: from.toUpperCase(), month: month, year: year }).lean()
  if (!data && !(await ExchangeRate.findOne({ month: month, year: year }).lean())) {
    const url = `https://ec.europa.eu/budg/inforeuro/api/public/monthly-rates?lang=EN&year=${year}&month=${month}`
    const res = await axios.get(url)
    if (res.status === 200) {
      const rates = (res.data as InforEuroResponse).map(
        (r) => ({ currency: r.isoA3Code, value: r.value, month: month, year: year } as ExchangeRateI)
      )
      ExchangeRate.insertMany(rates)
      data = rates.find((r) => r.currency === from.toUpperCase())
    }
  }
  if (!data) {
    return null
  }
  const rate = data.value
  amount = Math.round((amount / rate) * 100) / 100
  return { date: convertionDate, rate, amount }
}

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
