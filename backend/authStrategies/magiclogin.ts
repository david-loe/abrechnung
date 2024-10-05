import jwt from 'jsonwebtoken'
import MagicLoginStrategy from 'passport-magic-login'
import { escapeRegExp } from '../../common/scripts.js'
import { NotAllowedError } from '../controller/error.js'
import i18n from '../i18n.js'
import { sendMail } from '../mail/mail.js'
import User from '../models/user.js'

const secret = process.env.MAGIC_LOGIN_SECRET
const callbackUrl = process.env.VITE_BACKEND_URL + '/auth/magiclogin/callback'
const jwtOptions = {
  expiresIn: 60 * 120 // in seconds -> 120min
}

export default new MagicLoginStrategy.default({
  secret: secret,
  callbackUrl: callbackUrl,
  sendMagicLink: async (destination, href) => {
    var user = await User.findOne({ 'fk.magiclogin': { $regex: new RegExp('^' + escapeRegExp(destination) + '$', 'i') } }).lean()
    if (user) {
      sendMail(
        [user],
        i18n.t('mail.magiclogin.subject', { lng: user.settings.language }),
        i18n.t('mail.magiclogin.paragraph', { lng: user.settings.language }),
        { text: i18n.t('mail.magiclogin.buttonText', { lng: user.settings.language }), link: href },
        '',
        false
      )
    } else {
      throw new NotAllowedError('No magiclogin user found for e-mail: ' + destination)
    }
  },
  verify: async function (payload, callback) {
    var user = await User.findOne({ 'fk.magiclogin': { $regex: new RegExp('^' + escapeRegExp(payload.destination) + '$', 'i') } })
    if (user && (await user.isActive())) {
      callback(null, user, { redirect: payload.redirect })
    } else {
      callback(new NotAllowedError('No magiclogin user found for e-mail: ' + payload.destination))
    }
  },
  jwtOptions: jwtOptions
})

export function genAuthenticatedLink(payload: { destination: string; redirect: string }) {
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
