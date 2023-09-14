import express from 'express'
const router = express.Router()
import userRoutes from './user.js'

router.use('/user', userRoutes)

export default router
