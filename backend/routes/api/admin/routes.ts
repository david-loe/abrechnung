import express from 'express'
const router = express.Router()
import userRoutes from './user.js'
import Settings from '../../../models/settings.js'
import HealthInsurance from '../../../models/healthInsurance.js'
import Organisation from '../../../models/organisation.js'
import { accessControl, setter } from '../../../helper.js'

router.use(accessControl(['admin']))
router.use('/user', userRoutes)
router.post('/settings', setter(Settings, '', false))
router.post('/healthInsurance', setter(HealthInsurance))
router.post('/organisation', setter(Organisation))

export default router
