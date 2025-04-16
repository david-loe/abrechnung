import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { Types } from 'mongoose'
import multer from 'multer'
import fs from 'node:fs/promises'
import path from 'node:path'
import { DocumentFile as IDocumentFile, User as IUser, _id } from '../common/types.js'
import { logger } from './logger.js'
import DocumentFile from './models/documentFile.js'

export function objectsToCSV(objects: any[], separator = '\t', arraySeparator = ', '): string {
  let keys: string[] = []
  for (const obj of objects) {
    const oKeys = Object.keys(obj)
    if (keys.length < oKeys.length) {
      keys = oKeys
    }
  }
  let str = `${keys.join(separator)}\n`
  for (const obj of objects) {
    const col: string[] = []
    for (const key of keys) {
      if (!(key in obj)) {
        col.push('')
      } else if (Array.isArray(obj[key])) {
        col.push(`[${obj[key].join(arraySeparator)}]`)
      } else if (obj[key] === null) {
        col.push('null')
      } else {
        col.push(obj[key])
      }
    }
    str += `${col.join(separator)}\n`
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
      const reqDocuments = tmpCheckObj
      function multerFileName(i: number) {
        let str = pathToFiles.length > 0 ? pathToFiles[0] : ''
        for (let j = 1; j < pathToFiles.length; j++) {
          str += `[${pathToFiles[j]}]`
        }
        str += `[${i}][data]`
        return str
      }
      async function handleFile(reqDoc: any, i: number) {
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
      if (opts.multiple) {
        let iR = 0 // index reduction
        for (let i = 0; i < reqDocuments.length; i++) {
          const resultId = await handleFile(reqDocuments[i], i + iR)
          if (resultId) {
            reqDocuments[i] = resultId
          } else {
            reqDocuments.splice(i, 1)
            i -= 1
            iR += 1
          }
        }
      } else {
        await handleFile(reqDocuments, 0)
      }
    }
    if (next) {
      next()
    }
  }
}

export async function writeToDisk(
  filePath: string,
  data: string | NodeJS.ArrayBufferView | Iterable<string | NodeJS.ArrayBufferView> | AsyncIterable<string | NodeJS.ArrayBufferView>,
  retries = 5
): Promise<void> {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
  } catch (dirError: any) {
    logger.error(`Fehler beim Erstellen des Verzeichnisses: ${dirError}`)
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await fs.writeFile(filePath, data)
      return
    } catch (err: any) {
      if (err.code === 'EAGAIN' && attempt < retries) {
        logger.warn(`EAGAIN-Fehler beim Versuch ${attempt}. Neuer Versuch in 1 Sekunde...`)
        await new Promise((resolve) => setTimeout(resolve, 1000))
      } else {
        logger.error(`Fehler beim Schreiben der Datei '${filePath}': ${err}`)
      }
    }
  }
}

export function checkIfUserIsProjectSupervisor(user: IUser, projectId: _id): boolean {
  if (user.projects.supervised.length === 0) {
    return true
  }
  return user.projects.supervised.some((p) => p._id.equals(projectId))
}

export const fileHandler = multer({ limits: { fileSize: Number.parseInt(process.env.VITE_MAX_FILE_SIZE) } })

export function genAuthenticatedLink(
  payload: { destination: string; redirect: string },
  jwtOptions: jwt.SignOptions = { expiresIn: 60 * 120 }
) {
  const secret = process.env.MAGIC_LOGIN_SECRET
  const callbackUrl = `${process.env.VITE_BACKEND_URL}/auth/magiclogin/callback`
  return new Promise<string>((resolve, reject) => {
    const code = `${Math.floor(Math.random() * 90000) + 10000}`
    jwt.sign({ ...payload, code }, secret, jwtOptions, (err, token) => {
      if (err) {
        reject(err)
      } else {
        resolve(`${callbackUrl}?token=${token}`)
      }
    })
  })
}
