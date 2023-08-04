import Token from '../models/token'
import express from 'express'
import multer from 'multer'
import DocumentFile from '../models/documentFile'
import User from '../models/user'
import ejs from 'ejs'
import fs from 'fs'
import settings from '../../common/settings.json'
import i18n from '../i18n'

const router = express.Router()
const fileHandler = multer({ limits: { fileSize: 16000000 } })

router.get('/new', async (req, res) => {
  const user = await User.findOne({ _id: req.query.user })
  if (user && user.token && user.token._id.equals(req.query.token)) {
    const template = fs.readFileSync('./routes/upload.ejs', { encoding: 'utf-8' })
    const url = new URL(process.env.VITE_BACKEND_URL + '/upload/new')
    url.searchParams.append('user', req.query.user)
    url.searchParams.append('token', req.query.token)
    const secondsLeft = Math.round(
      (new Date(user.token.createdAt).valueOf() + settings.uploadTokenExpireAfterSeconds * 1000 - new Date().valueOf()) / 1000
    )
    const text = i18n.t('labels.tapToUpload')
    const renderedHTML = ejs.render(template, { url: url.href, expireAfterSeconds: settings.uploadTokenExpireAfterSeconds, secondsLeft, text })
    return res.send(renderedHTML)
  }
  return res.sendStatus(403)
})

router.post('/new', fileHandler.any(), async (req, res) => {
  const user = await User.findOne({ _id: req.query.user })
  if (user && user.token && user.token._id.equals(req.query.token)) {
    const token = new Token(user.token)
    if (req.body.files && req.files) {
      for (var i = 0; i < req.body.files.length; i++) {
        var buffer = null
        for (const file of req.files) {
          if (file.fieldname == 'files[' + i + '][data]') {
            buffer = file.buffer
            break
          }
        }
        if (buffer) {
          req.body.files[i].data = buffer
        }
      }
      for (const file of req.body.files) {
        token.files.push(await (new DocumentFile(file).save()))
      }
      token.markModified('files')
      await token.save()
      return res.send('ok')
    }
  }
  return res.sendStatus(403)
})

module.exports = router