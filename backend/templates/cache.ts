import fs from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

let mail: string | null = null
let upload: string | null = null
let fileUtils: string | null = null

export async function getMailTemplate() {
  if (!mail) {
    mail = await fs.readFile('./templates/mail.ejs', { encoding: 'utf-8' })
  }
  return mail
}

export async function getUploadTemplate() {
  if (!upload) {
    upload = await fs.readFile('./templates/upload.ejs', { encoding: 'utf-8' })
  }
  return upload
}

export async function getFileUtilsContent() {
  if (!fileUtils) {
    const __dirname = dirname(fileURLToPath(import.meta.url))
    fileUtils = await fs.readFile(`${__dirname}/../../common/utils/file.js`, { encoding: 'utf-8' })
  }
  return fileUtils
}
