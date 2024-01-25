import i18n from './i18n.js'
import DocumentFile from './models/documentFile.js'
import Settings from './models/settings.js'
import axios from 'axios'
import { datetimeToDateString } from '../common/scripts.js'
import { Model, Types, Schema, SchemaTypeOptions } from 'mongoose'
import { NextFunction, Request, Response } from 'express'
import { Access, GETResponse, Meta, SETResponse } from '../common/types.js'
import { log } from '../common/logger.js'
import fs from 'fs'

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
      const result1 = await model.findOne(conditions, select).lean()
      if (result1 != null) {
        meta.count = 1
        meta.countPages = 1
        let response: GETResponse<any> = { data: result1, meta }
        res.send(response)
      } else {
        res.status(404).send({ message: 'No ' + name + ' with id ' + req.query.id })
      }
    } else {
      var conditions: any = {}
      for (const field of Object.keys(req.query)) {
        const fields = Object.keys(model.schema.obj)
        if (fields.indexOf(field) === -1 && (field.indexOf('.') !== -1 && fields.indexOf(field.split('.')[0]) === -1)) {
          continue
        }
        if (req.query[field] && (req.query[field] as string[]).length > 0) {
          var qFilter: any = {}
          if ((req.query[field] as string[]).indexOf('name') !== -1) {
            qFilter[field] = { $regex: req.query[field], $options: 'i' }
          } else {
            qFilter[field] = req.query[field]
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
        let response: GETResponse<any[]> = { meta, data }
        res.send(response)
        if (cb) cb(data)
      } else {
        res.status(404).send({ message: 'No content' })
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
      try {
        if (checkOldObject) {
          if (!(await checkOldObject(oldObject))) {
            log(req.body)
            return res.sendStatus(403)
          }
        }
        Object.assign(oldObject, req.body)
        const result: SETResponse<any> = { message: i18n.t('alerts.successSaving'), result: (await oldObject.save()).toObject() }
        res.send(result)
        if (cb) cb(result.result)
      } catch (error) {
        res.status(400).send({ message: i18n.t('alerts.errorSaving'), error: error })
      }
    } else if (allowNew) {
      try {
        const result: SETResponse<any> = { message: i18n.t('alerts.successSaving'), result: (await new model(req.body).save()).toObject() }
        res.send(result)
        if (cb) cb(result.result)
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

const settings = (await Settings.findOne().lean())!

export async function convertCurrency(
  date: Date | string | number,
  amount: number,
  from: string,
  to: string = settings.baseCurrency._id
): Promise<{ date: Date; rate: number; amount: number } | null> {
  if (from === to) {
    return null
  }
  from = from.toUpperCase()
  to = to.toUpperCase()
  const convertionDate = new Date(date)
  if (convertionDate.valueOf() - new Date().valueOf() > 0) {
    date = new Date()
  }
  const dateStr = datetimeToDateString(convertionDate)
  const filePath = './data/exchange-rates/' + dateStr + '.json'
  var data: any = undefined
  if (fs.existsSync(filePath)) {
    const dataStr = fs.readFileSync(filePath, 'utf8')
    data = JSON.parse(dataStr)
  } else {
    const url = 'https://api.currencybeacon.com/v1/historical?api_key=' + process.env.CURRENCYBEACON_API_KEY + '&base=' + to + '&date=' + dateStr
    const res = await axios.get(url)
    if (res.status === 200) {
      data = res.data
      fs.writeFile(filePath, JSON.stringify(data), { encoding: 'utf-8' }, (error) => {
        if (error) {
          console.error(error)
        }
      })
    }
  }
  var rate = null
  if (data) {
    rate = data.rates[from]
  }
  if (!rate) {
    return null
  }
  amount = Math.round((amount / rate) * 100) / 100
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

export function accessControl(accesses: Access[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    var hasAccess = false
    for (const access of accesses) {
      if (req.user!.access[access]) {
        hasAccess = true
        break
      }
    }
    if (hasAccess) {
      next()
    } else {
      return res.status(405).send({ message: i18n.t('alerts.request.unauthorized') })
    }
  }
}

export function documentFileHandler(pathToFiles: string[], checkOwner = true, owner: undefined | string | Types.ObjectId = undefined) {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!owner) {
      owner = req.user!._id
    }
    owner = owner.toString()
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
  })
}

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return async function (req: Request, res: Response, next: NextFunction) {
    try {
      await fn(req, res, next)
    } catch (e) {
      next(e)
    }
  }
}
