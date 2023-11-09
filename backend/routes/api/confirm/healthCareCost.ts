import { documentFileHandler, getter, setter } from '../../../helper.js'
import express, { Request, Response } from 'express'
import multer from 'multer'
const fileHandler = multer({ limits: { fileSize: 16000000 } })
const router = express.Router()
import HealthCareCost, { HealthCareCostDoc } from '../../../models/healthCareCost.js'
import { sendHealthCareCostNotificationMail } from '../../../mail/mail.js'
import { HealthCareCost as IHealthCareCost } from '../../../../common/types.js'
import { generateHealthCareCostReport } from '../../../pdf/healthCareCost.js'
import { writeToDisk } from '../../../pdf/helper.js'

router.get('/', async (req, res) => {
  const sortFn = (a: IHealthCareCost, b: IHealthCareCost) => (a.updatedAt as Date).valueOf() - (b.updatedAt as Date).valueOf()
  const select: Partial<{ [key in keyof IHealthCareCost]: number }> = { history: 0, historic: 0 }
  var preCondition: any = {
    $and: [{ historic: false }, { $or: [{ state: 'underExaminationByInsurance' }, { state: 'refunded' }] }]
  }
  if (!req.query.addExpenses) {
    select.expenses = 0
  }
  delete req.query.addExpenses
  if (!req.query.addRefunded) {
    preCondition = { state: 'underExaminationByInsurance', historic: false }
  }
  delete req.query.addRefunded
  return getter(HealthCareCost, 'expense report', 20, preCondition, select, sortFn)(req, res)
})

router.get('/refunded', async (req, res) => {
  const sortFn = (a: IHealthCareCost, b: IHealthCareCost) => (b.updatedAt as Date).valueOf() - (a.updatedAt as Date).valueOf() // sort backwards
  const select: Partial<{ [key in keyof IHealthCareCost]: number }> = { history: 0, historic: 0 }

  return getter(HealthCareCost, 'expense report', 20, { state: 'refunded', historic: false }, select, sortFn)(req, res)
})

router.post(
  '/refunded',
  [fileHandler.any(), documentFileHandler(['refundSum', 'receipts'], false)],
  async (req: Request, res: Response) => {
    req.body = {
      state: 'refunded',
      refundSum: req.body.refundSum,
      editor: req.user!._id,
      comment: req.body.comment,
      _id: req.body._id
    }
    const check = async (oldObject: HealthCareCostDoc) => {
      if (oldObject.state === 'underExaminationByInsurance' && req.body.refundSum && req.body.refundSum.amount > 0) {
        await oldObject.saveToHistory()
        await oldObject.save()
        return true
      } else {
        return false
      }
    }
    const cb = async (healthCareCost: IHealthCareCost) => {
      sendHealthCareCostNotificationMail(healthCareCost)
      if (process.env.BACKEND_SAVE_REPORTS_ON_DISK.toLowerCase() === 'true') {
        await writeToDisk(
          '/reports/healthCareCost/confirmed/' +
            healthCareCost.applicant.name.familyName +
            ' ' +
            healthCareCost.applicant.name.givenName[0] +
            ' - ' +
            healthCareCost.name +
            '.pdf',
          await generateHealthCareCostReport(healthCareCost)
        )
      }
    }
    return setter(HealthCareCost, '', false, check, cb)(req, res)
  }
)

router.get('/report', async (req, res) => {
  const healthCareCost = await HealthCareCost.findOne({ _id: req.query.id, historic: false, state: 'refunded' }).lean()
  if (healthCareCost) {
    const report = await generateHealthCareCostReport(healthCareCost)
    res.setHeader(
      'Content-disposition',
      'attachment; filename=' +
        healthCareCost.applicant.name.familyName +
        ' ' +
        healthCareCost.applicant.name.givenName[0] +
        ' - ' +
        healthCareCost.name +
        '.pdf'
    )
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Length', report.length)
    return res.send(Buffer.from(report))
  } else {
    res.status(400).send({ message: 'No healthCareCost found' })
  }
})

export default router
