import express from 'express'
const router = express.Router()
import travelRoutes from './travel.js'
import documentFileRoutes from './documentFile.js'

router.use('/travel', travelRoutes)
router.use('/documentFile', documentFileRoutes)

export default router
