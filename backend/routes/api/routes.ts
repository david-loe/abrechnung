import express from 'express'
const router = express.Router()
import { UserDoc } from '../../models/user.js'
import travelRoutes from './travel.js'
import documentFileRoutes from './documentFile.js'
import expenseReportRoutes from './expenseReport.js'
import healthCareCostRoutes from './healthCareCost.js'
import approveRoutes from './approve/routes.js'
import examineRoutes from './examine/routes.js'
import confirmRoutes from './confirm/routes.js'
import i18n from '../../i18n.js'

router.use(async (req, res, next) => {
  if (req.isAuthenticated() && (await (req.user as UserDoc).isActive())) {
    next()
  } else {
    return res.status(401).send({ message: i18n.t('alerts.request.unauthorized') })
  }
})

router.use('/travel', travelRoutes)
router.use('/documentFile', documentFileRoutes)
router.use('/expenseReport', expenseReportRoutes)
router.use('/healthCareCost', healthCareCostRoutes)
router.use('/approve', approveRoutes)
router.use('/examine', examineRoutes)
router.use('/confirm', confirmRoutes)

export default router
