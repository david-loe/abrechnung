import express from 'express'
const router = express.Router()
import travelRoutes from './travel.js'
import { accessControl } from '../../../helper.js'

router.use(accessControl('approve'))
router.use('/travel', travelRoutes)

export default router
