import { getter, setter } from '../../../helper.js'
import Travel, { TravelDoc } from '../../../models/travel.js'
import { sendTravelNotificationMail } from '../../../mail/mail.js'
import express, { Request, Response } from 'express'
import { Travel as ITravel, TravelSimple as ITravelSimple } from '../../../../common/types.js'
import { writeToDisk } from '../../../pdf/helper.js'
import { generateAdvanceReport } from '../../../pdf/advance.js'
import Organisation from '../../../models/organisation.js'
const router = express.Router()

router.get('/', async (req, res) => {
  const sortFn = (a: ITravel, b: ITravel) => (a.updatedAt as Date).valueOf() - (b.updatedAt as Date).valueOf()
  return getter(
    Travel,
    'travel',
    20,
    { state: 'appliedFor', historic: false },
    { history: 0, stages: 0, expenses: 0, days: 0 },
    sortFn
  )(req, res)
})

router.get('/approved', async (req, res) => {
  const sortFn = (a: ITravel, b: ITravel) => (b.updatedAt as Date).valueOf() - (a.updatedAt as Date).valueOf() // sort backwards
  return getter(
    Travel,
    'travel',
    20,
    { state: 'approved', historic: false },
    { history: 0, stages: 0, expenses: 0, days: 0 },
    sortFn
  )(req, res)
})

router.post('/approved', async (req: Request, res: Response) => {
  req.body = {
    state: 'approved',
    editor: req.user!._id,
    comment: req.body.comment,
    _id: req.body._id
  }
  const check = async (oldObject: TravelDoc) => {
    if (oldObject.state === 'appliedFor') {
      await oldObject.saveToHistory()
      await oldObject.save()
      return true
    } else {
      return false
    }
  }
  const cb = async (travel: ITravelSimple) => {
    const org = await Organisation.findOne({ _id: travel.organisation._id })
    const subfolder = org ? org.subfolderPath : ''
    sendTravelNotificationMail(travel)
    if (travel.advance.amount !== null && travel.advance.amount > 0 && process.env.BACKEND_SAVE_REPORTS_ON_DISK.toLowerCase() === 'true') {
      await writeToDisk(
        '/reports/advance/' +
        subfolder +
        travel.owner.name.familyName +
        ' ' +
        travel.owner.name.givenName[0] +
        ' - ' +
        travel.name +
        '.pdf',
        await generateAdvanceReport(travel)
      )
    }
  }
  return setter(Travel, '', false, check, cb)(req, res)
})

router.post('/rejected', async (req: Request, res: Response) => {
  req.body = {
    state: 'rejected',
    editor: req.user!._id,
    comment: req.body.comment,
    _id: req.body._id
  }
  const check = async (oldObject: TravelDoc) => {
    return oldObject.state === 'appliedFor'
  }
  return setter(Travel, '', false, check, sendTravelNotificationMail)(req, res)
})

export default router
