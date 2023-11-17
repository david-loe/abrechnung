import express, { Request, Response } from 'express'
const router = express.Router()
import multer from 'multer'
const fileHandler = multer({ limits: { fileSize: 16000000 } })
import i18n from '../../i18n.js'
import { getter, setter, deleter, documentFileHandler } from '../../helper.js'
import HealthCareCost, { HealthCareCostDoc } from '../../models/healthCareCost.js'
import DocumentFile from '../../models/documentFile.js'
import User from '../../models/user.js'
import { sendHealthCareCostNotificationMail } from '../../mail/mail.js'
import { HealthCareCost as IHealthCareCost } from '../../../common/types.js'
import { generateHealthCareCostReport } from '../../pdf/healthCareCost.js'

router.get('/', async (req, res) => {
  const sortFn = (a: IHealthCareCost, b: IHealthCareCost) => (a.createdAt as Date).valueOf() - (b.createdAt as Date).valueOf()
  const select: Partial<{ [key in keyof IHealthCareCost]: number }> = { history: 0, historic: 0 }
  if (!req.query.addExpenses) {
    select.expenses = 0
  }
  delete req.query.addExpenses
  return getter(HealthCareCost, 'expense report', 20, { applicant: req.user!._id, historic: false }, select, sortFn)(req, res)
})

router.delete('/', deleter(HealthCareCost, 'applicant'))

router.post('/expense', [fileHandler.any(), documentFileHandler(['cost', 'receipts'], true)], async (req: Request, res: Response) => {
  const healthCareCost = await HealthCareCost.findOne({ _id: req.body.healthCareCostId })
  delete req.body.healthCareCostId
  if (
    !healthCareCost ||
    healthCareCost.historic ||
    healthCareCost.state !== 'inWork' ||
    !healthCareCost.applicant._id.equals(req.user!._id)
  ) {
    return res.sendStatus(403)
  }
  if (req.body._id && req.body._id !== '') {
    var found = false
    for (const expense of healthCareCost.expenses) {
      if (expense._id.equals(req.body._id)) {
        found = true
        Object.assign(expense, req.body)
        break
      }
    }
    if (!found) {
      return res.sendStatus(403)
    }
  } else {
    healthCareCost.expenses.push(req.body)
  }
  healthCareCost.expenses.sort((a, b) => new Date(a.cost.date).valueOf() - new Date(b.cost.date).valueOf())

  healthCareCost.markModified('expenses')
  try {
    const result = await healthCareCost.save()
    res.send({ message: i18n.t('alerts.successSaving'), result: result })
  } catch (error) {
    res.status(400).send({ message: i18n.t('alerts.errorSaving'), error: error })
  }
})

router.delete('/expense', async (req: Request, res: Response) => {
  const healthCareCost = await HealthCareCost.findOne({ _id: req.query.healthCareCostId })
  delete req.query.healthCareCostId
  if (
    !healthCareCost ||
    healthCareCost.historic ||
    healthCareCost.state !== 'inWork' ||
    !healthCareCost.applicant._id.equals(req.user!._id)
  ) {
    return res.sendStatus(403)
  }
  if (req.query.id && req.query.id !== '') {
    var found = false
    for (var i = 0; i < healthCareCost.expenses.length; i++) {
      if (healthCareCost.expenses[i]._id.equals(req.query.id as string)) {
        found = true
        if (healthCareCost.expenses[i].cost) {
          for (const receipt of healthCareCost.expenses[i].cost.receipts) {
            DocumentFile.deleteOne({ _id: receipt._id }).exec()
          }
        }
        healthCareCost.expenses.splice(i, 1)
        break
      }
    }
    if (!found) {
      return res.sendStatus(403)
    }
  } else {
    return res.status(400).send({ message: 'Missing id' })
  }
  healthCareCost.markModified('expenses')
  try {
    await healthCareCost.save()
    res.send({ message: i18n.t('alerts.successDeleting') })
  } catch (error) {
    res.status(400).send({ message: i18n.t('alerts.errorSaving'), error: error })
  }
})

router.post('/inWork', async (req, res) => {
  req.body = {
    state: 'inWork',
    applicant: req.user!._id,
    editor: req.user!._id,
    _id: req.body._id,
    name: req.body.name,
    patientName: req.body.patientName,
    insurance: req.body.insurance,
    organisation: req.body.organisation
  }

  if (!req.body.name) {
    try {
      var date = new Date()
      req.body.name =
        req.body.patientName +
        ' ' +
        i18n.t('monthsShort.' + date.getUTCMonth(), { lng: req.user!.settings.language }) +
        ' ' +
        date.getUTCFullYear()
    } catch (error) {
      return res.status(400).send(error)
    }
  }
  return setter(HealthCareCost, 'applicant', true)(req, res)
})

router.post('/underExamination', async (req, res) => {
  req.body = {
    state: 'underExamination',
    editor: req.user!._id,
    comment: req.body.comment,
    _id: req.body._id
  }

  const check = async (oldObject: HealthCareCostDoc) => {
    if (oldObject.state === 'inWork') {
      await oldObject.saveToHistory()
      await oldObject.save()
      return true
    } else {
      return false
    }
  }
  return setter(HealthCareCost, 'applicant', false, check, sendHealthCareCostNotificationMail)(req, res)
})

router.get('/report', async (req, res) => {
  const healthCareCost = await HealthCareCost.findOne({
    $and: [
      { _id: req.query.id, applicant: req.user!._id, historic: false },
      { $or: [{ state: 'refunded' }, { state: 'underExaminationByInsurance' }] }
    ]
  }).lean()
  if (healthCareCost) {
    const report = await generateHealthCareCostReport(healthCareCost)

    res.setHeader('Content-disposition', 'attachment; filename=' + healthCareCost.name + '.pdf')
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Length', report.length)
    return res.send(Buffer.from(report))
  } else {
    res.status(400).send({ message: 'No healthCareCost found' })
  }
})

router.get('/examiner', getter(User, 'examiner', 5, { 'access.examine/healthCareCost': true }, { name: 1, email: 1 }))

export default router
