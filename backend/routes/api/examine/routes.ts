import express from 'express'
const router = express.Router()
import travelRoutes from './travel.js'
import documentFileRoutes from './documentFile.js'
import expenseReportRoutes from './expenseReport.js'
import healthCareCostRoutes from './healthCareCost.js'
import { accessControl } from '../../../helper.js'

router.use('/travel', accessControl(['examine/travel']))
router.use('/travel', travelRoutes)
router.use('/documentFile', accessControl(['examine/travel', 'examine/expenseReport', 'examine/healthCareCost']))
router.use('/documentFile', documentFileRoutes)
router.use('/expenseReport', accessControl(['examine/expenseReport']))
router.use('/expenseReport', expenseReportRoutes)
router.use('/healthCareCost', accessControl(['examine/healthCareCost']))
router.use('/healthCareCost', healthCareCostRoutes)

export default router
