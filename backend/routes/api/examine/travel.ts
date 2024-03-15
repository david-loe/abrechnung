import { documentFileHandler, getter, setter } from '../../../helper.js'
import express, { Request, Response } from 'express'
const router = express.Router()
import DocumentFile from '../../../models/documentFile.js'
import Organisation from '../../../models/organisation.js'
import Travel, { TravelDoc } from '../../../models/travel.js'
import i18n from '../../../i18n.js'
import multer from 'multer'
const fileHandler = multer({ limits: { fileSize: 16000000 } })
import { sendTravelNotificationMail } from '../../../mail/mail.js'
import { generateTravelReport } from '../../../pdf/travel.js'
import { writeToDisk, writeToDiskFilePath } from '../../../pdf/helper.js'
import { Travel as ITravel } from '../../../../common/types.js'

router.get('/', async (req, res) => {
  const sortFn = (a: ITravel, b: ITravel) => (a.updatedAt as Date).valueOf() - (b.updatedAt as Date).valueOf()
  const select: Partial<{ [key in keyof ITravel]: number }> = { history: 0, historic: 0 }
  var preCondition: any = { $and: [{ historic: false }, { $or: [{ state: 'underExamination' }, { state: 'refunded' }] }] }
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
  if (!req.query.addRefunded) {
    preCondition = { state: 'underExamination', historic: false }
  }
  delete req.query.addRefunded
  return getter(Travel, 'travel', 20, preCondition, select, sortFn)(req, res)
})

router.get('/refunded', async (req, res) => {
  const sortFn = (a: ITravel, b: ITravel) => (b.updatedAt as Date).valueOf() - (a.updatedAt as Date).valueOf() // sort backwards

  const select: Partial<{ [key in keyof ITravel]: number }> = { history: 0, historic: 0, stages: 0, expenses: 0, days: 0 }

  return getter(Travel, 'travel', 20, { state: 'refunded', historic: false }, select, sortFn)(req, res)
})

router.post('/refunded', async (req, res) => {
  req.body = {
    state: 'refunded',
    editor: req.user!._id,
    comment: req.body.comment,
    _id: req.body._id
  }
  const check = async (oldObject: TravelDoc) => {
    if (oldObject.state === 'underExamination') {
      await oldObject.saveToHistory()
      await oldObject.save()
      return true
    } else {
      return false
    }
  }
  const cb = async (travel: ITravel) => {
    sendTravelNotificationMail(travel)
    if (process.env.BACKEND_SAVE_REPORTS_ON_DISK.toLowerCase() === 'true') {
      writeToDisk(await writeToDiskFilePath(travel), await generateTravelReport(travel))
    }
  }
  return setter(Travel, '', false, check, cb)(req, res)
})

router.post('/', async (req, res) => {
  req.body.editor = req.user!._id
  delete req.body.state
  delete req.body.owner
  delete req.body.history
  delete req.body.historic
  delete req.body.stages
  delete req.body.expenses
  delete req.body.professionalShare

  const check = async (oldObject: TravelDoc) => {
    return oldObject.state !== 'refunded'
  }
  return setter(Travel, '', false, check)(req, res)
})

function postRecord(recordType: 'stages' | 'expenses') {
  return async (req: Request, res: Response) => {
    const travel = await Travel.findOne({ _id: req.body.travelId })
    delete req.body.travelId
    if (!travel || travel.historic || travel.state !== 'underExamination') {
      return res.sendStatus(403)
    }

    await documentFileHandler(['cost', 'receipts'], false, travel.owner._id)(req, res, () => null)

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

router.post('/stage', fileHandler.any(), postRecord('stages'))
router.post('/expense', fileHandler.any(), postRecord('expenses'))

function deleteRecord(recordType: 'stages' | 'expenses') {
  return async (req: Request, res: Response) => {
    const travel = await Travel.findOne({ _id: req.query.travelId })
    delete req.query.travelId
    if (!travel || travel.historic || travel.state !== 'underExamination') {
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

router.get('/report', async (req, res) => {
  const travel = await Travel.findOne({ _id: req.query.id, historic: false, state: 'refunded' }).lean()
  if (travel) {
    const report = await generateTravelReport(travel)
    res.setHeader(
      'Content-disposition',
      'attachment; filename=' + travel.owner.name.familyName + ' ' + travel.owner.name.givenName[0] + ' - ' + travel.name + '.pdf'
    )
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Length', report.length)
    return res.send(Buffer.from(report))
  } else {
    res.status(400).send({ message: 'No travel found' })
  }
})

export default router
