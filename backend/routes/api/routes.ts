import express, { Response, Request } from 'express'
const router = express.Router()
import { accessControl, getter } from '../../helper.js'
import Currency from '../../models/currency.js'
import Country from '../../models/country.js'
import User from '../../models/user.js'
import { UserDoc } from '../../models/user.js'
import Settings from '../../models/settings.js'
import HealthInsurance from '../../models/healthInsurance.js'
import Organisation from '../../models/organisation.js'
import { Country as ICountry, accesses } from '../../../common/types.js'
import userRoutes from './user.js'
import travelRoutes from './travel.js'
import documentFileRoutes from './documentFile.js'
import expenseReportRoutes from './expenseReport.js'
import healthCareCostRoutes from './healthCareCost.js'
import adminRoutes from './admin/routes.js'
import approveRoutes from './approve/routes.js'
import examineRoutes from './examine/routes.js'
import confirmRoutes from './confirm/routes.js'
import i18n from '../../i18n.js'

router.use(async (req, res, next) => {
  if (req.isAuthenticated() && (await (req.user as UserDoc).isActive())) {
    next()
  } else {
    return res.status(401).send({ message: i18n.t('alerts.request.unauthorized') })
  }
})

router.use('/user', userRoutes)
router.use('/travel', travelRoutes)
router.use('/documentFile', documentFileRoutes)
router.use('/expenseReport', expenseReportRoutes)
router.use('/healthCareCost', healthCareCostRoutes)
router.use('/admin', adminRoutes)
router.use('/approve', approveRoutes)
router.use('/examine', examineRoutes)
router.use('/confirm', confirmRoutes)

router.delete('/logout', function (req, res) {
  req.logout(function (err) {
    if (err) {
      res.status(400).send({ error: err })
    }
  })
  res.send({ status: 'ok' })
})

router.get('/settings', getter(Settings, 'settings', 1))
router.get('/healthInsurance', getter(HealthInsurance, 'health insurance', 200))
router.get('/organisation', getter(Organisation, 'organisation', 50, {}, { name: 1 }))
router.get('/currency', getter(Currency, 'currency', 500))
router.get('/country', async (req, res) => {
  var select: Partial<{ [key in keyof ICountry]: number }> = { lumpSums: 0, lumpSumsFrom: 0 }
  if (req.query.addLumpSums) {
    select = {}
    delete req.query.addLumpSums
  }
  return getter(Country, 'country', 500, {}, select)(req, res)
})
router.get('/specialLumpSums', async (req, res) => {
  const allCountries = await Country.find().lean()
  const specialCountries: { [key: string]: string[] } = {}
  for (const c of allCountries) {
    const specials: string[] = []
    for (const lumpSum of c.lumpSums) {
      if (lumpSum.spezials) {
        for (const special of lumpSum.spezials) {
          if (specials.indexOf(special.city) === -1) {
            specials.push(special.city)
          }
        }
      }
    }
    if (specials.length > 0) {
      specialCountries[c._id] = specials
    }
  }
  res.send({ data: specialCountries })
})

const moreThanUser = accesses.filter((access) => access !== 'user')
router.get('/users', [accessControl(moreThanUser), async (req: Request, res: Response) => {
  return getter(User, 'user', 500, {}, { name: 1 })(req, res)
}])

export default router
