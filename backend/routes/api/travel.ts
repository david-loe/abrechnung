import express, { Request, Response } from 'express'
const router = express.Router()
import multer from 'multer'
const fileHandler = multer({ limits: { fileSize: 16000000 } })
import i18n from '../../i18n.js'
import { getter, setter, deleter, documentFileHandler } from '../../helper.js'
import Travel, { TravelDoc } from '../../models/travel.js'
import User from '../../models/user.js'
import DocumentFile from '../../models/documentFile.js'
import { sendTravelNotificationMail } from '../../mail/mail.js'
import { generateTravelReport } from '../../pdf/travel.js'
import { Travel as ITravel } from '../../../common/types.js'

router.get('/', async (req, res) => {
  const sortFn = (a: ITravel, b: ITravel) => (a.startDate as Date).valueOf() - (b.startDate as Date).valueOf()
  const select: Partial<{ [key in keyof ITravel]: number }> = { history: 0, historic: 0 }
  if (!req.query.addStages) {
    select.stages = 0
  }
  delete req.query.addStages
  if (!req.query.addExpenses) {
    select.expenses = 0
  }
  delete req.query.addExpenses
  if (!req.query.addDays) {
    select.days = 0
  }
  delete req.query.addDays
  return getter(Travel, 'travel', 20, { traveler: req.user!._id, historic: false }, select, sortFn)(req, res)
})

router.delete('/', deleter(Travel, 'traveler'))

router.post('/', async (req, res) => {
  req.body.editor = req.user!._id
  delete req.body.state
  delete req.body.traveler
  delete req.body.history
  delete req.body.historic
  delete req.body.stages
  delete req.body.expenses
  delete req.body.professionalShare

  const check = async (oldObject: TravelDoc) => {
    return oldObject.state !== 'refunded'
  }
  return setter(Travel, 'traveler', false, check)(req, res)
})

function postRecord(recordType: 'stages' | 'expenses') {
  return async (req: Request, res: Response) => {
    const travel = await Travel.findOne({ _id: req.body.travelId })
    delete req.body.travelId
    if (!travel || travel.historic || travel.state !== 'approved' || !travel.traveler._id.equals(req.user!._id)) {
      return res.sendStatus(403)
    }
    if (req.body._id && req.body._id !== '') {
      var found = false
      for (const record of travel[recordType]) {
        if (record._id.equals(req.body._id)) {
          found = true
          Object.assign(record, req.body)
          break
        }
      }
      if (!found) {
        return res.sendStatus(403)
      }
    } else {
      travel[recordType].push(req.body)
    }
    if (recordType === 'stages') {
      travel[recordType].sort((a, b) => new Date(a.departure).valueOf() - new Date(b.departure).valueOf())
    } else {
      travel[recordType].sort((a, b) => new Date(a.cost.date).valueOf() - new Date(b.cost.date).valueOf())
    }
    travel.markModified(recordType)
    try {
      const result1 = await travel.save()
      res.send({ message: i18n.t('alerts.successSaving'), result: result1 })
    } catch (error) {
      res.status(400).send({ message: i18n.t('alerts.errorSaving'), error: error })
    }
  }
}

router.post('/stage', [fileHandler.any(), documentFileHandler(['cost', 'receipts'], true)], postRecord('stages'))
router.post('/expense', [fileHandler.any(), documentFileHandler(['cost', 'receipts'], true)], postRecord('expenses'))

function deleteRecord(recordType: 'stages' | 'expenses') {
  return async (req: Request, res: Response) => {
    const travel = await Travel.findOne({ _id: req.query.travelId })
    delete req.query.travelId
    if (!travel || travel.historic || travel.state !== 'approved' || !travel.traveler._id.equals(req.user!._id)) {
      return res.sendStatus(403)
    }
    if (req.query.id && req.query.id !== '') {
      var found = false
      for (var i = 0; i < travel[recordType].length; i++) {
        if (travel[recordType][i]._id.equals(req.query.id as string)) {
          found = true
          if (travel[recordType][i].cost) {
            for (const receipt of travel[recordType][i].cost.receipts) {
              DocumentFile.deleteOne({ _id: receipt._id }).exec()
            }
          }
          travel[recordType].splice(i, 1)
          break
        }
      }
      if (!found) {
        return res.sendStatus(403)
      }
    } else {
      return res.status(400).send({ message: 'No ' + recordType.replace(/s$/, '') + ' found' })
    }
    travel.markModified(recordType)
    try {
      await travel.save()
      res.send({ message: i18n.t('alerts.successDeleting') })
    } catch (error) {
      res.status(400).send({ message: i18n.t('alerts.errorSaving'), error: error })
    }
  }
}

router.delete('/stage', deleteRecord('stages'))
router.delete('/expense', deleteRecord('expenses'))

router.post('/appliedFor', async (req, res) => {
  req.body = {
    state: 'appliedFor',
    traveler: req.user!._id,
    organisation: req.body.organisation,
    editor: req.user!._id,
    comment: null,
    _id: req.body._id,
    name: req.body.name,
    reason: req.body.reason,
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    destinationPlace: req.body.destinationPlace,
    lastPlaceOfWork: { country: req.body.destinationPlace.country },
    travelInsideOfEU: req.body.travelInsideOfEU,
    advance: req.body.advance,
    claimSpouseRefund: req.body.claimSpouseRefund,
    fellowTravelersNames: req.body.fellowTravelersNames
  }

  if (!req.body.name) {
    try {
      var date = new Date(req.body.startDate)
      req.body.name =
        req.body.destinationPlace.place +
        ' ' +
        i18n.t('monthsShort.' + date.getUTCMonth(), { lng: req.user!.settings.language }) +
        ' ' +
        date.getUTCFullYear()
    } catch (error) {
      return res.status(400).send(error)
    }
  }

  const check = async (oldObject: TravelDoc) => {
    return oldObject.state === 'appliedFor' || oldObject.state === 'rejected' || oldObject.state === 'approved'
  }
  return setter(Travel, 'traveler', true, check, sendTravelNotificationMail)(req, res)
})

router.post('/underExamination', async (req, res) => {
  req.body = {
    state: 'underExamination',
    editor: req.user!._id,
    comment: req.body.comment,
    _id: req.body._id
  }

  const check = async (oldObject: TravelDoc) => {
    if (oldObject.state === 'approved') {
      await oldObject.saveToHistory()
      const receipts = []
      for (const stage of oldObject.stages) {
        if (stage.transport.type == 'ownCar') {
          if (receipts.length == 0) {
            if (req.user!.vehicleRegistration) {
              for (const vr of req.user!.vehicleRegistration) {
                const doc = await DocumentFile.findOne({ _id: vr._id }).lean()
                delete (doc as unknown as any)._id
                receipts.push(await DocumentFile.create(doc))
              }
            }
          }
          stage.cost.receipts = receipts
        }
      }
      await oldObject.save()
      return true
    } else {
      return false
    }
  }
  return setter(Travel, 'traveler', false, check, sendTravelNotificationMail)(req, res)
})

router.get('/report', async (req, res) => {
  const travel = await Travel.findOne({ _id: req.query.id, traveler: req.user!._id, historic: false, state: 'refunded' }).lean()
  if (travel) {
    const report = await generateTravelReport(travel)
    res.setHeader('Content-disposition', 'attachment; filename=' + travel.name + '.pdf')
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Length', report.length)
    return res.send(Buffer.from(report))
  } else {
    res.status(400).send({ message: 'No travel found' })
  }
})

router.get('/examiner', getter(User, 'examiner', 5, { 'access.examine/travel': true }, { name: 1, email: 1 }))

export default router
