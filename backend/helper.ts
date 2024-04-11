import axios from 'axios'
import { NextFunction, Request, Response } from 'express'
import fs from 'fs/promises'
import { Schema, Types } from 'mongoose'
import { ExchangeRate as ExchangeRateI, DocumentFile as IDocumentFile, baseCurrency } from '../common/types.js'
import DocumentFile from './models/documentFile.js'
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

type FileHandleOptions = { checkOwner?: boolean; owner?: string | Types.ObjectId; multiple?: boolean }
export function documentFileHandler(pathToFiles: string[], options: FileHandleOptions = {}) {
  const opts = Object.assign({ checkOwner: true, multiple: true }, options)
  return async (req: Request, res?: Response, next?: NextFunction) => {
    const fileOwner = opts.owner ? opts.owner : req.user?._id
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
    if (pathExists && ((Array.isArray(tmpCheckObj) && req.files && opts.multiple) || (!opts.multiple && req.file))) {
      let reqDocuments = tmpCheckObj
      function multerFileName(i: number) {
        var str = pathToFiles.length > 0 ? pathToFiles[0] : ''
        for (var j = 1; j < pathToFiles.length; j++) {
          str += '[' + pathToFiles[j] + ']'
        }
        str += '[' + i + '][data]'
        return str
      }
      async function handleFile(reqDoc: any) {
        if (!reqDoc._id) {
          var buffer = null
          if (opts.multiple) {
            for (const file of req.files as Express.Multer.File[]) {
              if (file.fieldname == multerFileName(i + iR)) {
                buffer = file.buffer
                break
              }
            }
          } else {
            buffer = req.file!.buffer
          }
          if (buffer) {
            reqDoc.owner = fileOwner
            reqDoc.data = buffer
            const dbDoc = (await new DocumentFile(reqDoc).save()).toObject() as Partial<IDocumentFile>
            delete dbDoc.data
            delete reqDoc.data
            Object.assign(reqDoc, dbDoc)
          } else {
            return undefined
          }
        } else {
          const documentFile = await DocumentFile.findOne({ _id: reqDoc._id }, { owner: 1 }).lean()
          if (!documentFile || (opts.checkOwner && !documentFile.owner.equals(fileOwner))) {
            return undefined
          }
        }
        return reqDoc._id
      }
      if (opts.multiple) {
        var iR = 0 // index reduction
        for (var i = 0; i < reqDocuments.length; i++) {
          const resultId = await handleFile(reqDocuments[i])
          if (resultId) {
            reqDocuments[i] = resultId
          } else {
            reqDocuments.splice(i, 1)
            i -= 1
            iR += 1
          }
        }
      } else {
        await handleFile(reqDocuments)
      }
      console.log(reqDocuments)
    }
    if (next) {
      next()
    }
  }
}

export async function writeToDisk(
  filePath: string,
  data: string | NodeJS.ArrayBufferView | Iterable<string | NodeJS.ArrayBufferView> | AsyncIterable<string | NodeJS.ArrayBufferView>
) {
  // create folders
  var root = ''
  var folderPath = filePath
  if (folderPath[0] === '/') {
    root = '/'
    folderPath = folderPath.slice(1)
  }
  const folders = folderPath.split('/').slice(0, -1) // remove last item (file)
  var cfolderPath = root
  for (const folder of folders) {
    cfolderPath = cfolderPath + folder + '/'
    try {
      await fs.access(cfolderPath)
    } catch {
      await fs.mkdir(cfolderPath)
    }
  }
  try {
    await fs.writeFile(filePath, data)
  } catch (error) {
    console.error(error)
  }
}
