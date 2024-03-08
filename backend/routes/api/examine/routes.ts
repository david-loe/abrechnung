import express from 'express'
const router = express.Router()
import travelRoutes from './travel.js'
import healthCareCostRoutes from './healthCareCost.js'
import { accessControl } from '../../../helper.js'

router.use('/travel', accessControl(['examine/travel']))
router.use('/travel', travelRoutes)
router.use('/healthCareCost', accessControl(['examine/healthCareCost']))
router.use('/healthCareCost', healthCareCostRoutes)

export default router
