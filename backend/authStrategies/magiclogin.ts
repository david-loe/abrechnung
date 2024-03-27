import { default as MagicLoginStrategy } from 'passport-magic-login'
import { NotAllowedError } from '../controller/error.js'
import i18n from '../i18n.js'
import { sendMail } from '../mail/mail.js'
import User from '../models/user.js'

const magicLogin = new MagicLoginStrategy.default({
  secret: process.env.MAGIC_LOGIN_SECRET,
  callbackUrl: process.env.VITE_BACKEND_URL + '/auth/magiclogin/callback',
  sendMagicLink: async (destination, href) => {
    var user = await User.findOne({ 'fk.magiclogin': destination }).lean()
    if (user) {
      sendMail(
        [user],
        'Login abrechnung🧾',
        i18n.t('mail.magiclogin.paragraph', { lng: user.settings.language }),
        { text: i18n.t('mail.magiclogin.buttonText', { lng: user.settings.language }), link: href },
        ''
      )
    } else {
      throw new NotAllowedError('No magiclogin user found for e-mail: ' + destination)
    }
  },
  verify: async function (payload, callback) {
    var user = await User.findOne({ 'fk.magiclogin': payload.destination }).lean()
    if (user) {
      callback(null, user, { redirect: payload.redirect })
    } else {
      callback(new NotAllowedError('No magiclogin user found for e-mail: ' + payload.destination))
    }
  },
  jwtOptions: {
    expiresIn: '30m'
  }
})

export default magicLogin
