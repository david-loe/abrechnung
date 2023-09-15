import express from 'express'
const router = express.Router()
import travelRoutes from './travel.js'
import documentFileRoutes from './documentFile.js'
import expenseReportRoutes from './expenseReport.js'

router.use('/travel', travelRoutes)
router.use('/documentFile', documentFileRoutes)
router.use('/expenseReport', expenseReportRoutes)

export default router
