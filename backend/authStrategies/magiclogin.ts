import MagicLoginStrategy from 'passport-magic-login'
import { escapeRegExp } from '../../common/scripts.js'
import { NotAllowedError } from '../controller/error.js'
import ENV from '../env.js'
import i18n from '../i18n.js'
import User from '../models/user.js'
import { sendMail } from '../notifications/mail.js'

const secret = ENV.MAGIC_LOGIN_SECRET
const callbackUrl = `${ENV.VITE_BACKEND_URL}/auth/magiclogin/callback`
const options = {
  expiresIn: 60 * 120 // in seconds -> 120min
}

export default new MagicLoginStrategy.default({
  secret: secret,
  callbackUrl: callbackUrl,
  sendMagicLink: async (destination, href) => {
    const user = await User.findOne({ 'fk.magiclogin': { $regex: new RegExp(`^${escapeRegExp(destination)}$`, 'i') } }).lean()
    if (!user) {
      throw new NotAllowedError(`No magiclogin user found for e-mail: ${destination}`)
    }
    sendMail(
      [user],
      i18n.t('mail.magiclogin.subject', { lng: user.settings.language }),
      i18n.t('mail.magiclogin.paragraph', { lng: user.settings.language }),
      { text: i18n.t('mail.magiclogin.buttonText', { lng: user.settings.language }), link: href },
      undefined,
      false
    )
  },
  verify: async (payload, callback) => {
    const user = await User.findOne({ 'fk.magiclogin': { $regex: new RegExp(`^${escapeRegExp(payload.destination)}$`, 'i') } })
    if (user && (await user.isActive())) {
      callback(null, user, { redirect: payload.redirect })
    } else {
      callback(new NotAllowedError(`No magiclogin user found for e-mail: ${payload.destination}`))
    }
  },
  jwtOptions: options
})
