import express from 'express'
const router = express.Router()
import healthCareCostRoutes from './healthCareCost.js'
import { accessControl } from '../../../helper.js'

router.use('/healthCareCost', accessControl(['confirm/healthCareCost']))
router.use('/healthCareCost', healthCareCostRoutes)

export default router
