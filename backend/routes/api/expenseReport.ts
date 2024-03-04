import express, { Request, Response } from 'express'
const router = express.Router()
import multer from 'multer'
const fileHandler = multer({ limits: { fileSize: 16000000 } })
import i18n from '../../i18n.js'
import { getter, setter, deleter, documentFileHandler } from '../../helper.js'
import ExpenseReport, { ExpenseReportDoc } from '../../models/expenseReport.js'
import DocumentFile from '../../models/documentFile.js'
import User from '../../models/user.js'
import { sendExpenseReportNotificationMail } from '../../mail/mail.js'
import { ExpenseReport as IExpenseReport } from '../../../common/types.js'
import { generateExpenseReportReport } from '../../pdf/expenseReport.js'


router.post('/inWork', async (req, res) => {
  req.body = {
    state: 'inWork',
    owner: req.user!._id,
    organisation: req.body.organisation,
    editor: req.user!._id,
    _id: req.body._id,
    name: req.body.name
  }

  if (!req.body.name) {
    try {
      var date = new Date()
      req.body.name =
        i18n.t('labels.expenses', { lng: req.user!.settings.language }) +
        ' ' +
        i18n.t('monthsShort.' + date.getUTCMonth(), { lng: req.user!.settings.language }) +
        ' ' +
        date.getUTCFullYear()
    } catch (error) {
      return res.status(400).send(error)
    }
  }
  return setter(ExpenseReport, 'owner', true)(req, res)
})

router.post('/underExamination', async (req, res) => {
  req.body = {
    state: 'underExamination',
    editor: req.user!._id,
    comment: req.body.comment,
    _id: req.body._id
  }

  const check = async (oldObject: ExpenseReportDoc) => {
    if (oldObject.state === 'inWork') {
      await oldObject.saveToHistory()
      await oldObject.save()
      return true
    } else {
      return false
    }
  }
  return setter(ExpenseReport, 'owner', false, check, sendExpenseReportNotificationMail)(req, res)
})

router.get('/report', async (req, res) => {
  const expenseReport = await ExpenseReport.findOne({
    _id: req.query.id,
    owner: req.user!._id,
    historic: false,
    state: 'refunded'
  }).lean()
  if (expenseReport) {
    const report = await generateExpenseReportReport(expenseReport)
    res.setHeader('Content-disposition', 'attachment; filename=' + expenseReport.name + '.pdf')
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Length', report.length)
    return res.send(Buffer.from(report))
  } else {
    res.status(400).send({ message: 'No expenseReport found' })
  }
})

router.get('/examiner', getter(User, 'examiner', 5, { 'access.examine/expenseReport': true }, { name: 1, email: 1 }))

export default router
