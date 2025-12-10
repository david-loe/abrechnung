import { BaseCurrencyMoneyNotNull, DocumentFile as IDocumentFile, User as IUser, Money } from 'abrechnung-common/types.js'
import { getBaseCurrencyAmount } from 'abrechnung-common/utils/scripts.js'
import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { Types } from 'mongoose'
import multer from 'multer'
import ENV from './env.js'
import DocumentFile from './models/documentFile.js'

interface ReqDocument extends Omit<IDocumentFile, 'data'> {
  data?: Buffer<ArrayBufferLike>
}
type FileHandleOptions = { checkOwner?: boolean; owner?: string | Types.ObjectId; multiple?: boolean }
export function documentFileHandler(pathToFiles: string[], options: FileHandleOptions = {}) {
  const opts = Object.assign({ checkOwner: true, multiple: true }, options)
  return async (req: Request, _res?: Response, next?: NextFunction) => {
    let fileOwner: Types.ObjectId
    if (opts.owner) {
      fileOwner = new Types.ObjectId(opts.owner)
    } else if (req.user) {
      fileOwner = req.user._id
    } else {
      throw new Error('No owner for uploaded files')
    }

    let pathExists = true
    let tmpCheckObj = req.body
    for (const prop of pathToFiles) {
      if (tmpCheckObj[prop]) {
        tmpCheckObj = tmpCheckObj[prop]
      } else {
        pathExists = false
        break
      }
    }
    if (pathExists && ((Array.isArray(tmpCheckObj) && req.files && opts.multiple) || (!opts.multiple && req.file))) {
      const reqDocuments: ReqDocument[] | ReqDocument = tmpCheckObj
      function multerFileName(i: number) {
        let str = pathToFiles.length > 0 ? pathToFiles[0] : ''
        for (let j = 1; j < pathToFiles.length; j++) {
          str += `[${pathToFiles[j]}]`
        }
        str += `[${i}][data]`
        return str
      }
      async function handleFile(reqDoc: ReqDocument, i: number) {
        if (!reqDoc._id) {
          let buffer = null
          if (opts.multiple) {
            for (const file of req.files as Express.Multer.File[]) {
              if (file.fieldname === multerFileName(i)) {
                buffer = file.buffer
                break
              }
            }
          } else {
            buffer = req.file?.buffer
          }
          if (buffer) {
            reqDoc.owner = fileOwner
            reqDoc.data = buffer
            const dbDoc = (await new DocumentFile(reqDoc).save()).toObject() as Partial<IDocumentFile>
            dbDoc.data = undefined
            reqDoc.data = undefined
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
      if (opts.multiple && Array.isArray(reqDocuments)) {
        let iR = 0 // index reduction
        for (let i = 0; i < reqDocuments.length; i++) {
          const resultId = await handleFile(reqDocuments[i], i + iR)
          if (resultId) {
            // biome-ignore lint/suspicious/noExplicitAny: using Types.ObjectId to set IdDocument in backend
            ;(reqDocuments[i] as any) = resultId
          } else {
            reqDocuments.splice(i, 1)
            i -= 1
            iR += 1
          }
        }
      } else {
        await handleFile(reqDocuments as ReqDocument, 0)
      }
    }
    if (next) {
      next()
    }
  }
}

export function checkIfUserIsProjectSupervisor(user: IUser<Types.ObjectId>, projectId: Types.ObjectId): boolean {
  if (user.projects.supervised.length === 0) {
    return true
  }
  return user.projects.supervised.some((p) => p._id.equals(projectId))
}

export const fileHandler = multer({ limits: { fileSize: ENV.VITE_MAX_FILE_SIZE } })

export function genAuthenticatedLink(
  payload: { destination: string; redirect: string },
  jwtOptions: jwt.SignOptions = { expiresIn: 60 * 120 }
) {
  const secret = ENV.MAGIC_LOGIN_SECRET
  const callbackUrl = `${ENV.VITE_BACKEND_URL}/auth/magiclogin/callback`
  return new Promise<string>((resolve, reject) => {
    const code = `${Math.floor(Math.random() * 90_000) + 10_000}`
    jwt.sign({ ...payload, code }, secret, jwtOptions, (err, token) => {
      if (err) {
        reject(err)
      } else {
        resolve(`${callbackUrl}?token=${token}`)
      }
    })
  })
}

export function setAdvanceBalance(advance: { budget: Money; balance?: BaseCurrencyMoneyNotNull }) {
  advance.balance = { amount: getBaseCurrencyAmount(advance.budget) }
}

interface FormField {
  field: string
  val: string | boolean | number
}

/**⚠️ Potential issue | 🔴 Critical
 *
 * When an array element is a primitive or a Date, the recursive call iterates zero properties and never pushes anything, so arrays of IDs/flags/strings simply vanish from the payload. That breaks every form using scalar arrays.
 */
// biome-ignore lint/suspicious/noExplicitAny: generic function
export function objectToFormFields(object: any, fieldPrefix = '', formFields: FormField[] = []): FormField[] {
  for (const key in object) {
    const field = fieldPrefix ? `${fieldPrefix}[${key}]` : key
    if (object[key] === null || object[key] === undefined) {
    } else if (Array.isArray(object[key])) {
      for (let i = 0; i < object[key].length; i++) {
        objectToFormFields(object[key][i], `${field}[${i}]`, formFields)
      }
    } else if (object[key] instanceof Date) {
      formFields.push({ field, val: object[key].toJSON() })
    } else if (typeof object[key] === 'object') {
      objectToFormFields(object[key], field, formFields)
    } else {
      formFields.push({ field, val: object[key] })
    }
  }
  return formFields
}
