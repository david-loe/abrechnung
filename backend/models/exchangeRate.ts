import axios from 'axios'
import { model, Schema } from 'mongoose'
import { baseCurrency, ExchangeRate as IExchangeRate } from '../../common/types.js'

const exchangeRateSchema = new Schema<IExchangeRate>({
  currency: { type: String, ref: 'Currency', required: true },
  value: { type: Number, min: 0, required: true },
  year: { type: Number, min: 1999, required: true },
  month: { type: Number, enum: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], required: true }
})

const ExchangeRate = model<IExchangeRate>('ExchangeRate', exchangeRateSchema)

export default ExchangeRate

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
  let conversionDate = new Date(date)
  if (conversionDate.valueOf() - new Date().valueOf() > 0) {
    conversionDate = new Date()
  }
  const month = conversionDate.getUTCMonth() + 1
  const year = conversionDate.getUTCFullYear()
  let data: IExchangeRate | null | undefined = await ExchangeRate.findOne({ currency: from.toUpperCase(), month: month, year: year }).lean()
  if (!data && !(await ExchangeRate.findOne({ month: month, year: year }).lean())) {
    const url = `https://ec.europa.eu/budg/inforeuro/api/public/monthly-rates?lang=EN&year=${year}&month=${month}`
    const res = await axios.get(url)
    if (res.status === 200) {
      const rates = (res.data as InforEuroResponse).map(
        (r) => ({ currency: r.isoA3Code, value: r.value, month: month, year: year }) as IExchangeRate
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
  return { date: conversionDate, rate, amount }
}
