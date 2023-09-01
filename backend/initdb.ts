import fs from 'fs'
import { csvToObjects, parseRawLumpSums, addLumpSumsToCountries } from './helper.js'
import { getFlagEmoji } from '../common/scripts.js'
import Currency from './models/currency.js'
import Country from './models/country.js'
import { Model } from 'mongoose'
import User from './models/user.js'

function loadLumpSums() {
  const lumpSums: { validFrom: Date; data: any }[] = []
  fs.readdirSync('./data').forEach((file) => {
    const matched = file.match(/lumpSums_(\d{4}-\d{2}-\d{2})\.tsv/i)
    if (matched && matched.length > 1) {
      const dataStr = fs.readFileSync('./data/' + file, 'utf8')
      const validFrom = new Date(matched[1])
      const data = parseRawLumpSums(dataStr)
      lumpSums.push({ validFrom, data })
    }
  })
  return lumpSums
}

function loadCountries() {
  const dataStr = fs.readFileSync('./data/countries.tsv', 'utf8')
  const result: any[] = csvToObjects(dataStr)
  result.forEach((c) => (c.flag = getFlagEmoji(c.code as string)))
  return result
}

function loadCurrencies() {
  const dataStr = fs.readFileSync('./data/currencies.tsv', 'utf8')
  const result: any[] = csvToObjects(dataStr)
  result.forEach((c) => (c.flag = getFlagEmoji(c.code as string)))
  return result
}

async function initer(model: Model<any>, name: string, data: any[]) {
  const docs = await model.find({}).lean()
  if (docs.length === 0) {
    const newDocs = await model.insertMany(data)
    console.log('Added ' + newDocs.length + ' ' + name)
  } else {
    console.log(docs.length + ' ' + name + ' exist')
  }
}

async function addAllLumpSums() {
  const lumpSums = loadLumpSums()
  lumpSums.sort((a, b) => a.validFrom.valueOf() - b.validFrom.valueOf())
  for (const lumpSum of lumpSums) {
    const result = await addLumpSumsToCountries(lumpSum.data, lumpSum.validFrom, 'de')
    console.log(
      'Lump sum from ' +
        lumpSum.validFrom.toDateString() +
        ': ' +
        result.success.length +
        ' updated - ' +
        result.noUpdate.length +
        ' not updated - ' +
        result.noCountryFound.length +
        ' no country found'
    )
    for (const notFound of result.noCountryFound) {
      console.log(notFound.country)
    }
  }
}

export default async function initDB() {
  await initer(Currency, 'currencies', loadCurrencies())
  await initer(Country, 'countries', loadCountries())
  await initer(User, 'users', [{ uid: process.env.ADMIN_UID, access: { admin: true } }])
  await addAllLumpSums()
}
