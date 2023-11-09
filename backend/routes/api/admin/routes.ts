import express from 'express'
const router = express.Router()
import userRoutes from './user.js'
import Settings from '../../../models/settings.js'
import HealthInsurance from '../../../models/healthInsurance.js'
import Organisation from '../../../models/organisation.js'
import { accessControl, setter } from '../../../helper.js'
import Country from '../../../models/country.js'
import Currency from '../../../models/currency.js'

router.use(accessControl(['admin']))
router.use('/user', userRoutes)
router.post('/settings', setter(Settings, '', false))
router.post('/healthInsurance', setter(HealthInsurance))
router.post('/organisation', setter(Organisation))
router.post('/country', setter(Country))
router.post('/currency', setter(Currency))

export default router
