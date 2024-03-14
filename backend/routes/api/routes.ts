import express from 'express'
const router = express.Router()
import { UserDoc } from '../../models/user.js'
import examineRoutes from './examine/routes.js'
import i18n from '../../i18n.js'

router.use(async (req, res, next) => {
  if (req.isAuthenticated() && (await (req.user as UserDoc).isActive())) {
    next()
  } else {
    return res.status(401).send({ message: i18n.t('alerts.request.unauthorized') })
  }
})

router.use('/examine', examineRoutes)

export default router
