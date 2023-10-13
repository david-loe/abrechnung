import i18n from './i18n.js'
import Country from './models/country.js'
import DocumentFile from './models/documentFile.js'
import axios from 'axios'
import settings from '../common/settings.json' assert { type: 'json' }
import { datetimeToDateString } from '../common/scripts.js'
import { Model, Types, Schema, SchemaTypeOptions } from 'mongoose'
import { NextFunction, Request, Response } from 'express'
import { Access, CountryLumpSum, Meta } from '../common/types.js'
import { log } from '../common/logger.js'

export function getter(
  model: Model<any>,
  name: string,
  defaultLimit = 10,
  preConditions = {},
  select = {},
  sortFn: ((a: any, b: any) => number) | null = null,
  cb: ((data: any) => any) | null = null
) {
  return async (req: Request, res: Response) => {
    const meta: Meta = {
      limit: defaultLimit,
      page: 1,
      count: 0,
      countPages: 0
    }
    if (req.query.limit && parseInt(req.query.limit as string) <= meta.limit && parseInt(req.query.limit as string) > 0) {
      meta.limit = parseInt(req.query.limit as string)
    }
    delete req.query.limit
    if (req.query.page && parseInt(req.query.page as string) > 0) {
      meta.page = parseInt(req.query.page as string)
    }
    delete req.query.page
    if (req.query.id && req.query.id != '') {
      var conditions: any = Object.assign({ _id: req.query.id }, preConditions)
      const result = await model.findOne(conditions, select).lean()
      if (result != null) {
        res.send({ data: result })
      } else {
        res.status(204).send({ message: 'No ' + name + ' with id ' + req.query.id })
      }
    } else {
      var conditions: any = {}
      for (const filter of Object.keys(req.query)) {
        if (req.query[filter] && (req.query[filter] as string[]).length > 0) {
          var qFilter: any = {}
          if ((req.query[filter] as string[]).indexOf('name') !== -1) {
            qFilter[filter] = { $regex: req.query[filter], $options: 'i' }
          } else {
            qFilter[filter] = req.query[filter]
          }
          if (!('$and' in conditions)) {
            conditions.$and = []
          }
          conditions.$and.push(qFilter)
        }
      }
      if (Object.keys(preConditions).length > 0) {
        if (!('$and' in conditions)) {
          conditions.$and = []
        }
        conditions.$and.push(preConditions)
      }
      const result = await model.find(conditions, select).lean()
      meta.count = result.length
      meta.countPages = Math.ceil(meta.count / meta.limit)
      if (result != null) {
        if (sortFn) {
          result.sort(sortFn)
        }
        const data = result.slice(meta.limit * (meta.page - 1), meta.limit * meta.page)
        res.send({ meta, data })
        if (cb) cb(data)
      } else {
        res.status(204).send({ message: 'No content' })
      }
    }
  }
}

export function setter(
  model: Model<any>,
  checkUserIdField = '',
  allowNew = true,
  checkOldObject: ((oldObject: any) => Promise<boolean>) | null = null,
  cb: ((data: any) => any) | null = null
) {
  return async (req: Request, res: Response) => {
    if (!req.body._id) {
      for (const field of Object.keys(model.schema.obj)) {
        const property = model.schema.obj[field]! as SchemaTypeOptions<any>
        if (property.required && !('default' in property)) {
          if (
            req.body[field] === undefined ||
            (property.type === String && req.body[field].length === 0) ||
            (property.type === Number && req.body[field] === null) ||
            (Array.isArray(property) && req.body[field].length === 0)
          ) {
            log(req.body)
            return res.status(400).send({ message: 'Missing ' + field })
          }
        }
      }
    }
    if (req.body._id && req.body._id !== '') {
      var oldObject = await model.findOne({ _id: req.body._id })
      if (checkUserIdField && checkUserIdField in model.schema.obj) {
        if (!oldObject || !oldObject[checkUserIdField]._id.equals(req.user!._id)) {
          log(req.body)
          return res.sendStatus(403)
        }
      }
      if (checkOldObject) {
        if (!(await checkOldObject(oldObject))) {
          log(req.body)
          return res.sendStatus(403)
        }
      }
      try {
        Object.assign(oldObject, req.body)
        const result = (await oldObject.save()).toObject()
        res.send({ message: i18n.t('alerts.successSaving'), result: result })
        if (cb) cb(result)
      } catch (error) {
        res.status(400).send({ message: i18n.t('alerts.errorSaving'), error: error })
      }
    } else if (allowNew) {
      try {
        const result = (await new model(req.body).save()).toObject()
        res.send({ message: i18n.t('alerts.successSaving'), result: result })
        if (cb) cb(result)
      } catch (error) {
        res.status(400).send({ message: i18n.t('alerts.errorSaving'), error: error })
      }
    } else {
      log(req.body)
      return res.sendStatus(403)
    }
  }
}

export function deleter(model: Model<any>, checkUserIdField = '', cb: ((data: any) => any) | null = null) {
  return async (req: Request, res: Response) => {
    if (req.query.id && req.query.id !== '') {
      const doc = await model.findOne({ _id: req.query.id })
      if (!doc || (checkUserIdField && checkUserIdField in model.schema.obj && !doc[checkUserIdField]._id.equals(req.user!._id))) {
        log(req.query)
        return res.sendStatus(403)
      }
      try {
        await doc.deleteOne()
        res.send({ message: i18n.t('alerts.successDeleting') })
        if (cb) cb(req.query.id)
      } catch (error) {
        res.status(400).send({ message: i18n.t('alerts.errorDeleting'), error: error })
      }
    } else {
      return res.status(400).send({ message: 'Missing id' })
    }
  }
}

/**
 * @returns Array of JS Objects
 */
export function csvToObjects(csv: string, separator = '\t', arraySeparator = ', '): { [key: string]: string | string[] }[] {
  var lines = csv.split('\n')
  var result = []
  var headers = lines[0].split(separator)
  for (var i = 1; i < lines.length; i++) {
    var obj: { [key: string]: string | string[] } = {}
    if (lines[i] === '') {
      break
    }
    var currentline = lines[i].split(separator)
    for (var j = 0; j < headers.length; j++) {
      // search for [] to identify arrays
      const match = currentline[j].match(/^\[(.*)\]$/)
      if (match === null) {
        if (currentline[j] !== '') {
          obj[headers[j]] = currentline[j]
        }
      } else {
        obj[headers[j]] = match[1].split(arraySeparator)
      }
    }
    result.push(obj)
  }
  return result
}

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

export function parseRawLumpSums(dataStr: string) {
  const general = /im Übrigen/i
  const spezialStart = /^–\s{2,}(.*)/i
  const data: { [key: string]: string | string[] | { [key: string]: string | string[] }[] }[] = csvToObjects(dataStr)
  var spezials = []
  for (var i = data.length - 1; i >= 0; i--) {
    const matched = (data[i].country as string).match(spezialStart)
    if (matched && matched.length > 1) {
      data[i].city = matched[1]
      delete data[i].country
      spezials.push(data[i])
      data.splice(i, 1)
    } else if (spezials.length > 0) {
      for (var j = spezials.length - 1; j >= 0; j--) {
        if (general.test(spezials[j].city as string)) {
          delete spezials[j].city
          Object.assign(data[i], spezials[j])
          spezials.splice(j, 1)
          break
        }
      }
      data[i].spezials = spezials as { [key: string]: string | string[] }[]
      spezials = []
    }
  }
  return data
}

function convertRawLumpSum(raw: {
  [key: string]: string | string[] | { [key: string]: string | string[] }[]
}): Omit<CountryLumpSum, 'validFrom'> {
  const spezials: CountryLumpSum['spezials'] = []
  if (raw.spezials) {
    for (const spezial of raw.spezials as { [key: string]: string | string[] }[]) {
      spezials.push({
        catering24: parseInt(spezial.catering24 as string, 10),
        catering8: parseInt(spezial.catering8 as string, 10),
        overnight: parseInt(spezial.overnight as string, 10),
        city: spezial.city as string
      })
    }
  }

  return {
    catering24: parseInt(raw.catering24 as string, 10),
    catering8: parseInt(raw.catering8 as string, 10),
    overnight: parseInt(raw.overnight as string, 10),
    spezials
  }
}

export async function addLumpSumsToCountries(
  lumpSums: { [key: string]: string | string[] | { [key: string]: string | string[] }[] }[],
  validFrom: Date,
  countryNameLanguage = 'de'
) {
  const conditions: any = {}
  const noCountryFound = []
  const success = []
  const noUpdate = []
  for (const lumpSum of lumpSums) {
    conditions.$or = [{}, {}]
    conditions.$or[0]['name.' + countryNameLanguage] = lumpSum.country
    conditions.$or[1]['alias.' + countryNameLanguage] = lumpSum.country

    const country = await Country.findOne(conditions)
    if (country) {
      var newData = true
      for (const countrylumpSums of country.lumpSums) {
        if (countrylumpSums.validFrom >= validFrom) {
          newData = false
          break
        }
      }
      if (newData) {
        const newLumpSum: CountryLumpSum = Object.assign({ validFrom }, convertRawLumpSum(lumpSum))
        country.lumpSums.push(newLumpSum)
        country.markModified('lumpSums')
        success.push(await country.save())
      } else {
        noUpdate.push(country)
      }
    } else {
      noCountryFound.push(lumpSum)
    }
  }
  return { success, noUpdate, noCountryFound }
}

export async function convertCurrency(
  date: Date | string | number,
  amount: number,
  from: string,
  to: string = settings.baseCurrency._id
): Promise<{ date: Date; rate: number; amount: number } | null> {
  from = from.toLowerCase()
  to = to.toLowerCase()
  const convertionDate = new Date(date)
  if (convertionDate.valueOf() - new Date().valueOf() > 0) {
    date = new Date()
  }
  const dateStr = datetimeToDateString(convertionDate)
  const baseURLs = [
    'https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/',
    'https://raw.githubusercontent.com/fawazahmed0/currency-api/1/'
  ]
  const suffixs = ['.min.json', '.json']
  var rate = null
  outerloop: for (const baseURL of baseURLs) {
    for (const suffix of suffixs) {
      const url = baseURL + dateStr + '/currencies/' + from + '/' + to + suffix
      const res = await axios.get(url)
      if (res.status === 200) {
        rate = res.data[to]
        break outerloop
      }
    }
  }
  if (rate == null) {
    return null
  }

  amount = Math.round(amount * rate * 100) / 100
  return { date: convertionDate, rate, amount }
}

export function costObject(exchangeRate = true, receipts = true, required = false, defaultCurrency: string | null = null) {
  const costObject: any = {
    amount: { type: Number, min: 0, required: required, default: null },
    currency: { type: String, ref: 'Currency', required: required, default: defaultCurrency }
  }
  if (exchangeRate) {
    costObject.exchangeRate = {
      date: { type: Date },
      rate: { type: Number, min: 0 },
      amount: { type: Number, min: 0 }
    }
  }
  if (receipts) {
    costObject.receipts = [{ type: Schema.Types.ObjectId, ref: 'DocumentFile', required: required }]
    costObject.date = { type: Date, required: required }
  }
  return costObject
}

export function accessControl(accesses: Access[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    var hasAccess = false
    for (const access of accesses) {
      if (req.user!.access[access]) {
        hasAccess = true
      }
    }
    if (hasAccess) {
      next()
    } else {
      return res.status(403).send({ message: i18n.t('alerts.request.unauthorized') })
    }
  }
}

export function documentFileHandler(pathToFiles: string[], checkOwner = true, owner: undefined | string | Types.ObjectId = undefined) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!owner) {
      owner = req.user!._id
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
            reqDocuments[i].owner = owner
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
          if (!documentFile || (checkOwner && !documentFile.owner.equals(owner))) {
            reqDocuments.splice(i, 1)
            i -= 1
            iR += 1
            continue
          }
        }
        reqDocuments[i] = reqDocuments[i]._id
      }
    }
    next()
  }
}
