import fs from 'node:fs/promises'

let mail: string | null = null
let upload: string | null = null

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
