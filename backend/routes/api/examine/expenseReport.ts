import { getter, setter } from '../../../helper.js'
import express, { Request, Response } from 'express'
const router = express.Router()
import DocumentFile from '../../../models/documentFile.js'
import ExpenseReport, { ExpenseReportDoc } from '../../../models/expenseReport.js'
import i18n from '../../../i18n.js'
import multer from 'multer'
const fileHandler = multer({ limits: { fileSize: 16000000 } })
import { sendExpenseReportNotificationMail } from '../../../mail/mail.js'
import { ExpenseReport as IExpenseReport } from '../../../../common/types.js'
import { writeToDisk } from '../../../pdf/helper.js'
import { generateExpenseReportReport } from '../../../pdf/expenseReport.js'

router.get('/', async (req, res) => {
  const sortFn = (a: IExpenseReport, b: IExpenseReport) => (a.updatedAt as Date).valueOf() - (b.updatedAt as Date).valueOf()
  const select: Partial<{ [key in keyof IExpenseReport]: number }> = { history: 0, historic: 0 }
  var preCondition: any = { $and: [{ historic: false }, { $or: [{ state: 'underExamination' }, { state: 'refunded' }] }] }
  if (!req.query.addExpenses) {
    select.expenses = 0
  }
  delete req.query.addExpenses
  if (!req.query.addRefunded) {
    preCondition = { state: 'underExamination', historic: false }
  }
  delete req.query.addRefunded
  return getter(ExpenseReport, 'expense report', 20, preCondition, select, sortFn)(req, res)
})

router.get('/refunded', async (req, res) => {
  const sortFn = (a: IExpenseReport, b: IExpenseReport) => (b.updatedAt as Date).valueOf() - (a.updatedAt as Date).valueOf() // sort backwards
  const select: Partial<{ [key in keyof IExpenseReport]: number }> = { history: 0, historic: 0 }

  return getter(ExpenseReport, 'expense report', 20, { state: 'refunded', historic: false }, select, sortFn)(req, res)
})

router.post('/refunded', async (req, res) => {
  req.body = {
    state: 'refunded',
    editor: req.user!._id,
    comment: req.body.comment,
    _id: req.body._id
  }
  const check = async (oldObject: ExpenseReportDoc) => {
    if (oldObject.state === 'underExamination') {
      await oldObject.saveToHistory()
      await oldObject.save()
      return true
    } else {
      return false
    }
  }
  const cb = async (expenseReport: IExpenseReport) => {
    sendExpenseReportNotificationMail(expenseReport)
    if (process.env.BACKEND_SAVE_REPORTS_ON_DISK.toLowerCase() === 'true') {
      await writeToDisk(
        '/reports/expenseReport' + expenseReport.expensePayer.name + ' - ' + expenseReport.name + '.pdf',
        await generateExpenseReportReport(expenseReport)
      )
    }
  }
  return setter(ExpenseReport, '', false, check, cb)(req, res)
})

router.post('/expense', fileHandler.any(), async (req: Request, res: Response) => {
  const expenseReport = await ExpenseReport.findOne({ _id: req.body.expenseReportId })
  delete req.body.expenseReportId
  if (!expenseReport || expenseReport.historic || expenseReport.state !== 'underExamination') {
    return res.sendStatus(403)
  }

  if (req.body.cost && req.body.cost.receipts && req.files) {
    for (var i = 0; i < req.body.cost.receipts.length; i++) {
      var buffer = null
      for (const file of req.files as Express.Multer.File[]) {
        if (file.fieldname == 'cost[receipts][' + i + '][data]') {
          buffer = file.buffer
          break
        }
      }
      if (buffer) {
        req.body.cost.receipts[i].owner = expenseReport.expensePayer._id
        req.body.cost.receipts[i].data = buffer
      }
    }
  }

  if (req.body._id && req.body._id !== '') {
    var found = false
    outer_loop: for (const expense of expenseReport.expenses) {
      if (expense._id.equals(req.body._id)) {
        if (req.body.cost && req.body.cost.receipts && req.files) {
          for (var i = 0; i < req.body.cost.receipts.length; i++) {
            if (req.body.cost.receipts[i]._id) {
              var foundReceipt = false
              for (const oldReceipt of expense.cost.receipts) {
                if (oldReceipt._id!.equals(req.body.cost.receipts[i]._id)) {
                  foundReceipt = true
                }
              }
              if (!foundReceipt) {
                break outer_loop
              }
              await DocumentFile.findOneAndUpdate({ _id: req.body.cost.receipts[i]._id }, req.body.cost.receipts[i])
            } else {
              var result = await new DocumentFile(req.body.cost.receipts[i]).save()
              req.body.cost.receipts[i] = result._id
            }
          }
          expenseReport.markModified('expenses.cost.receipts')
        }
        found = true
        Object.assign(expense, req.body)
        break
      }
    }
    if (!found) {
      return res.sendStatus(403)
    }
  } else {
    if (req.body.cost && req.body.cost.receipts && req.files) {
      for (var i = 0; i < req.body.cost.receipts.length; i++) {
        var result = await new DocumentFile(req.body.cost.receipts[i]).save()
        req.body.cost.receipts[i] = result._id
      }
      expenseReport.markModified('expenses.cost.receipts')
    }
    expenseReport.expenses.push(req.body)
  }
  expenseReport.expenses.sort((a, b) => new Date(a.cost.date).valueOf() - new Date(b.cost.date).valueOf())
  expenseReport.markModified('expenses')
  try {
    const result1 = await expenseReport.save()
    res.send({ message: i18n.t('alerts.successSaving'), result: result1 })
  } catch (error) {
    res.status(400).send({ message: i18n.t('alerts.errorSaving'), error: error })
  }
})

router.delete('/expense', async (req: Request, res: Response) => {
  const expenseReport = await ExpenseReport.findOne({ _id: req.query.expenseReportId })
  delete req.query.expenseReportId
  if (!expenseReport || expenseReport.historic || expenseReport.state !== 'underExamination') {
    return res.sendStatus(403)
  }
  if (req.query.id && req.query.id !== '') {
    var found = false
    for (var i = 0; i < expenseReport.expenses.length; i++) {
      if (expenseReport.expenses[i]._id.equals(req.query.id as string)) {
        found = true
        if (expenseReport.expenses[i].cost) {
          for (const receipt of expenseReport.expenses[i].cost.receipts) {
            DocumentFile.deleteOne({ _id: receipt._id }).exec()
          }
        }
        expenseReport.expenses.splice(i, 1)
        break
      }
    }
    if (!found) {
      return res.sendStatus(403)
    }
  } else {
    return res.status(400).send({ message: 'Missing id' })
  }
  expenseReport.markModified('expenses')
  try {
    await expenseReport.save()
    res.send({ message: i18n.t('alerts.successDeleting') })
  } catch (error) {
    res.status(400).send({ message: i18n.t('alerts.errorSaving'), error: error })
  }
})

router.get('/report', async (req, res) => {
  const expenseReport = await ExpenseReport.findOne({ _id: req.query.id, historic: false, state: 'refunded' }).lean()
  if (expenseReport) {
    const report = await generateExpenseReportReport(expenseReport)
    res.setHeader('Content-disposition', 'attachment; filename=' + expenseReport.expensePayer.name + ' - ' + expenseReport.name + '.pdf')
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Length', report.length)
    return res.send(Buffer.from(report))
  } else {
    res.status(400).send({ message: 'No expenseReport found' })
  }
})

export default router
