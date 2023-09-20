import express from 'express'
const router = express.Router()
import userRoutes from './user.js'
import { accessControl } from '../../../helper.js'

router.use(accessControl(['admin']))
router.use('/user', userRoutes)

export default router
