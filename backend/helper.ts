import DocumentFile from './models/documentFile.js'
import axios from 'axios'
import { Types, Schema } from 'mongoose'
import { NextFunction, Request, Response } from 'express'
import { ExchangeRate as ExchangeRateI, baseCurrency } from '../common/types.js'
import ExchangeRate from './models/exchangeRate.js'

export function objectsToCSV(objects: any[], separator = '\t', arraySeparator = ', '): string {
  var keys: string[] = []
  for (const obj of objects) {
    const oKeys = Object.keys(obj)
    if (keys.length < oKeys.length) {
      keys = oKeys
    }
  }
  var str = keys.join(separator) + '\n'
  for (const obj of objects) {
    const col: string[] = []
    for (const key of keys) {
      if (!(key in obj)) {
        col.push('')
      } else if (Array.isArray(obj[key])) {
        col.push('[' + obj[key].join(arraySeparator) + ']')
      } else if (obj[key] === null) {
        col.push('null')
      } else {
        col.push(obj[key])
      }
    }
    str += col.join(separator) + '\n'
  }
  return str
}

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

export function costObject(exchangeRate = true, receipts = true, required = false, defaultCurrency: string | null = null) {
  const costObject: any = {
    amount: { type: Number, min: 0, required: required, default: null }
  }
  if (exchangeRate) {
    costObject.exchangeRate = {
      date: { type: Date },
      rate: { type: Number, min: 0 },
      amount: { type: Number, min: 0 }
    }
    costObject.currency = { type: String, ref: 'Currency', required: required, default: defaultCurrency }
  }
  if (receipts) {
    costObject.receipts = [{ type: Schema.Types.ObjectId, ref: 'DocumentFile', required: required }]
    costObject.date = {
      type: Date,
      validate: {
        validator: (v: Date | string | number) => new Date().valueOf() >= new Date(v).valueOf(),
        message: 'futureNotAllowed'
      },
      required: required
    }
  }
  return costObject
}

export function documentFileHandler(pathToFiles: string[], checkOwner = true, owner: undefined | string | Types.ObjectId = undefined) {
  return async (req: Request, res?: Response, next?: NextFunction) => {
    const fileOwner = owner ? owner : req.user?._id
    if (!fileOwner) {
      throw new Error('No owner for uploaded files')
    }
    var pathExists = true
    var tmpCheckObj = req.body
    for (const prop of pathToFiles) {
      if (tmpCheckObj[prop]) {
        tmpCheckObj = tmpCheckObj[prop]
      } else {
        pathExists = false
        break
      }
    }
    if (pathExists && Array.isArray(tmpCheckObj) && req.files) {
      const reqDocuments = tmpCheckObj
      const multerFileName = (i: number) => {
        var str = pathToFiles.length > 0 ? pathToFiles[0] : ''
        for (var j = 1; j < pathToFiles.length; j++) {
          str += '[' + pathToFiles[j] + ']'
        }
        str += '[' + i + '][data]'
        return str
      }
      var iR = 0 // index reduction
      for (var i = 0; i < reqDocuments.length; i++) {
        if (!reqDocuments[i]._id) {
          var buffer = null
          for (const file of req.files as Express.Multer.File[]) {
            if (file.fieldname == multerFileName(i + iR)) {
              buffer = file.buffer
              break
            }
          }
          if (buffer) {
            reqDocuments[i].owner = fileOwner
            reqDocuments[i].data = buffer
            reqDocuments[i] = await new DocumentFile(reqDocuments[i]).save()
          } else {
            reqDocuments.splice(i, 1)
            i -= 1
            iR += 1
            continue
          }
        } else {
          const documentFile = await DocumentFile.findOne({ _id: reqDocuments[i]._id }, { owner: 1 }).lean()
          if (!documentFile || (checkOwner && !documentFile.owner.equals(fileOwner))) {
            reqDocuments.splice(i, 1)
            i -= 1
            iR += 1
            continue
          }
        }
        reqDocuments[i] = reqDocuments[i]._id
      }
    }
    if (next) {
      next()
    }
  }
}
