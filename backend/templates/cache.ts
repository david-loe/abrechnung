import fs from 'node:fs/promises'

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
    const fileURL = await import.meta.resolve('abrechnung-common/utils/file.js')
    fileUtils = await fs.readFile(new URL(fileURL), { encoding: 'utf-8' })
  }
  return fileUtils
}
