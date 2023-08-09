const helper = require('../helper')
const router = require('express').Router()
import DocumentFile from '../models/documentFile'
const Travel = require('../models/travel')
const i18n = require('../i18n')
const multer = require('multer')
const fileHandler = multer({ limits: { fileSize: 16000000 } })
const mail = require('../mail/mail')
const pdf = require('../pdf/generate')


router.get('/travel', async (req, res) => {
  const sortFn = (a, b) => a.startDate - b.startDate
  const select = { history: 0, historic: 0 }
  if (!req.query.stages) {
    select.stages = 0
  }
  if (!req.query.expenses) {
    select.expenses = 0
  }
  if (!req.query.days) {
    select.days = 0
  }
  return helper.getter(Travel, 'travel', 20, { state: 'underExamination', historic: false }, select, sortFn)(req, res)
})

router.get('/travel/refunded', async (req, res) => {
  const sortFn = (a, b) => a.startDate - b.startDate
  const select = { history: 0, historic: 0 }
  if (!req.query.stages) {
    select.stages = 0
  }
  if (!req.query.expenses) {
    select.expenses = 0
  }
  if (!req.query.days) {
    select.days = 0
  }
  return helper.getter(Travel, 'travel', 20, { state: 'refunded', historic: false }, select, sortFn)(req, res)
})

router.post('/travel/refunded', async (req, res) => {
  req.body = {
    state: 'refunded',
    editor: req.user._id,
    comment: req.body.comment,
    _id: req.body._id
  }
  const check = async (oldObject) => {
    if (oldObject.state === 'underExamination') {
      await oldObject.saveToHistory()
      await oldObject.save()
      return true
    } else {
      return false
    }
  }
  const cb = async (travel) => {
    mail.sendNotificationMail(travel)
    if (process.env.BACKEND_SAVE_REPORTS_ON_DISK.toLowerCase() === 'true') {
      await pdf.generateAndWriteToDisk('/reports/' + travel.traveler.name + ' - ' + travel.name + '.pdf', travel)
    }
  }
  return helper.setter(Travel, '', false, check, cb)(req, res)
})

function postRecord(recordType) {
  return async (req, res) => {
    const travel = await Travel.findOne({ _id: req.body.travelId })
    delete req.body.travelId
    if (!travel || travel.historic || travel.state !== 'underExamination') {
      return res.sendStatus(403)
    }

    if (req.body.cost && req.body.cost.receipts && req.files) {
      for (var i = 0; i < req.body.cost.receipts.length; i++) {
        var buffer = null
        for (const file of req.files) {
          if (file.fieldname == 'cost[receipts][' + i + '][data]') {
            buffer = file.buffer
            break
          }
        }
        if (buffer) {
          req.body.cost.receipts[i].owner = travel.traveler._id
          req.body.cost.receipts[i].data = buffer
        }
      }
    }

    if (req.body._id && req.body._id !== '') {
      var found = false
      outer_loop:
      for (const record of travel[recordType]) {
        if (record._id.equals(req.body._id)) {
          if (req.body.cost && req.body.cost.receipts && req.files) {
            for (var i = 0; i < req.body.cost.receipts.length; i++) {
              if (req.body.cost.receipts[i]._id) {
                var foundReceipt = false
                for (const oldReceipt of record.cost.receipts) {
                  if (oldReceipt._id.equals(req.body.cost.receipts[i]._id)) {
                    foundReceipt = true
                  }
                }
                if (!foundReceipt) {
                  break outer_loop
                }
                await DocumentFile.findOneAndUpdate({ _id: req.body.cost.receipts[i]._id }, req.body.cost.receipts[i])
              } else {
                var result = await (new DocumentFile(req.body.cost.receipts[i])).save()
                req.body.cost.receipts[i] = result._id
              }
            }
            travel.markModified(recordType + '.cost.receipts')
          }
          found = true
          Object.assign(record, req.body)
          break
        }
      }
      if (!found) {
        return res.sendStatus(403)
      }
    } else {
      if (req.body.cost && req.body.cost.receipts && req.files) {
        for (var i = 0; i < req.body.cost.receipts.length; i++) {
          var result = await (new DocumentFile(req.body.cost.receipts[i])).save()
          req.body.cost.receipts[i] = result._id
        }
        travel.markModified(recordType + '.cost.receipts')
      }
      travel[recordType].push(req.body)
    }
    travel[recordType].sort((a, b) => new Date(a.departure) - new Date(b.departure))
    travel.markModified(recordType)
    try {
      const result1 = await travel.save()
      res.send({ message: i18n.t('alerts.successSaving'), result: result1 })
    } catch (error) {
      res.status(400).send({ message: i18n.t('alerts.errorSaving'), error: error })
    }
  }
}

router.post('/travel/stage', fileHandler.any(), postRecord('stages'))
router.post('/travel/expense', fileHandler.any(), postRecord('expenses'))

function deleteRecord(recordType) {
  return async (req, res) => {
    const travel = await Travel.findOne({ _id: req.query.travelId })
    delete req.query.travelId
    if (!travel || travel.historic || travel.state !== 'underExamination') {
      return res.sendStatus(403)
    }
    if (req.query.id && req.query.id !== '') {
      var found = false
      for (var i = 0; i < travel[recordType].length; i++) {
        if (travel[recordType][i]._id.equals(req.query.id)) {
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

router.delete('/travel/stage', deleteRecord('stages'))
router.delete('/travel/expense', deleteRecord('expenses'))

router.get('/documentFile', async (req, res) => {
  const file = await DocumentFile.findOne({ _id: req.query.id })
  if (file) {
    res.setHeader('Content-Type', file.type);
    res.setHeader('Content-Length', file.data.length);
    return res.send(file.data)
  } else {
    return res.sendStatus(403)
  }
})

router.delete('/documentFile', async (req, res) => {
  const file = await DocumentFile.findOne({ _id: req.query.id })
  if (file) {
    await DocumentFile.deleteOne({ _id: file._id })
    return res.send({ message: i18n.t('alerts.successDeleting') })
  } else {
    return res.sendStatus(403)
  }
})



router.get('/travel/report', async (req, res) => {
  const travel = await Travel.findOne({ _id: req.query.id, historic: false, state: 'refunded' })
  if (travel) {
    const report = await pdf.generateReport(travel)
    res.setHeader('Content-disposition', 'attachment; filename=' + travel.traveler.name + ' - ' + travel.name + '.pdf');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', report.length);
    return res.send(new Buffer.from(report))
  } else {
    res.status(400).send({ message: 'No travel found' })
  }
})


module.exports = router