import { getter, setter, deleter } from '../../../helper.js'
import User from '../../../models/user.js'
import { User as IUser } from '../../../../common/types.js'
import express from 'express'
import { sendMail } from '../../../mail/mail.js'
import i18n from '../../../i18n.js'
const router = express.Router()

router.get('/', getter(User, 'user', 500))
router.post('/', async (req, res) => {
    var cb: ((data: any) => any) | null = null
    if (!req.body._id && req.body.fk && req.body.fk.magiclogin) {
        cb = (user: IUser) => {
            sendMail(
                [user], i18n.t('mail.newMagiclogin.subject', { lng: user.settings.language }),
                i18n.t('mail.newMagiclogin.paragraph', { lng: user.settings.language }),
                { text: i18n.t('mail.newMagiclogin.buttonText', { lng: user.settings.language }), link: process.env.VITE_FRONTEND_URL },
                i18n.t('mail.newMagiclogin.lastParagraph', { lng: user.settings.language })
            )
        }
    }
    setter(User, '', true, null, cb)(req, res)
})
router.delete('/', deleter(User))

export default router
