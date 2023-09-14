import express from 'express'
const router = express.Router()
import travelRoutes from './travel.js'

router.use('/travel', travelRoutes)

export default router
