import { NextFunction, Request, Response } from 'express'
import fs from 'fs/promises'
import jwt from 'jsonwebtoken'
import { Model, Types } from 'mongoose'
import multer from 'multer'
import {
  _id,
  AnyState,
  DocumentFile as IDocumentFile,
  ExpenseReport as IExpenseReport,
  HealthCareCost as IHealthCareCost,
  Travel as ITravel,
  User as IUser,
  reportIsHealthCareCost,
  reportIsTravel
} from '../common/types.js'
import DocumentFile from './models/documentFile.js'
import ExpenseReport from './models/expenseReport.js'
import HealthCareCost from './models/healthCareCost.js'
import Travel from './models/travel.js'

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

export async function getSubmissionReportFromHistory(
  report: ITravel | IExpenseReport | IHealthCareCost,
  overwriteQueryState?: AnyState
): Promise<ITravel | IExpenseReport | IHealthCareCost | null> {
  let model: Model<ITravel | IExpenseReport | IHealthCareCost> = ExpenseReport as any
  let state: AnyState = 'inWork'
  if (reportIsTravel(report)) {
    model = Travel as any
    state = 'approved'
  } else if (reportIsHealthCareCost(report)) {
    model = HealthCareCost as any
  }
  if (overwriteQueryState) {
    state = overwriteQueryState
  }
  for (var i = 0; i < report.history.length; i++) {
    const historyReport = await model.findOne({ _id: report.history[i] }).lean()
    if (historyReport && historyReport.state === state) {
      return historyReport
    }
  }
  return null
}

export function checkIfUserIsProjectSupervisor(user: IUser, projectId: _id): boolean {
  if (user.projects.supervised.length === 0) {
    return true
  }
  return user.projects.supervised.some((p) => p._id.equals(projectId))
}

export const fileHandler = multer({ limits: { fileSize: parseInt(process.env.VITE_MAX_FILE_SIZE) } })

export function genAuthenticatedLink(
  payload: { destination: string; redirect: string },
  jwtOptions: jwt.SignOptions = { expiresIn: 60 * 120 }
) {
  const secret = process.env.MAGIC_LOGIN_SECRET
  const callbackUrl = process.env.VITE_BACKEND_URL + '/auth/magiclogin/callback'
  return new Promise<string>((resolve, reject) => {
    const code = Math.floor(Math.random() * 90000) + 10000 + ''
    jwt.sign({ ...payload, code }, secret, jwtOptions, (err, token) => {
      if (err) {
        reject(err)
      } else {
        resolve(`${callbackUrl}?token=${token}`)
      }
    })
  })
}
