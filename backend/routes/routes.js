import express from 'express'
const router = express.Router()
import multer from 'multer'
const fileHandler = multer({ limits: { fileSize: 16000000 } })
import Token from '../models/token'
import i18n from '../i18n'
import { getter, setter, deleter } from '../helper'
import Travel from '../models/travel'
import Currency from '../models/currency'
import Country from '../models/country'
import DocumentFile from '../models/documentFile'
import mail from '../mail/mail'
import pdf from '../pdf/generate'

router.delete('/logout', function (req, res) {
  req.logout(function (err) {
    if (err) {
      res.status(400).send({ error: err })
    }
  })
  res.send({ status: 'ok' })
})

router.get('/user', async (req, res) => {
  res.send({ data: req.user })
})

router.get('/user/token', async (req, res) => {
  res.send({ data: req.user.token })
})

router.delete('/user/token', async (req, res) => {
  req.user.token = null
  await req.user.save()
  res.send({ message: i18n.t('alerts.successDeleting') })
})

router.post('/user/token', async (req, res) => {
  const token = await (new Token().save())
  req.user.token = token
  req.user.save()
  res.send({ message: i18n.t('alerts.successSaving'), result: token })
})

router.post('/user/settings', async (req, res) => {
  Object.assign(req.user.settings, req.body)
  req.user.markModified('settings')
  try {
    const result = await req.user.save()
    res.send({ message: i18n.t('alerts.successSaving'), result: result.settings })
  } catch (error) {
    res.status(400).send({ message: i18n.t('alerts.errorSaving'), error: error })
  }
})

router.post('/user/vehicleRegistration', fileHandler.any(), async (req, res) => {
  if (req.body.vehicleRegistration && req.files) {
    for (var i = 0; i < req.body.vehicleRegistration.length; i++) {
      var buffer = null
      for (const file of req.files) {
        if (file.fieldname == 'vehicleRegistration[' + i + '][data]') {
          buffer = file.buffer
          break
        }
      }
      if (buffer) {
        req.body.vehicleRegistration[i].owner = req.user._id
        req.body.vehicleRegistration[i].data = buffer
      }
    }
    for (var i = 0; i < req.body.vehicleRegistration.length; i++) {
      if (req.body.vehicleRegistration[i]._id) {
        var foundReceipt = false
        for (const oldReceipt of req.user.vehicleRegistration) {
          if (oldReceipt._id.equals(req.body.vehicleRegistration[i]._id)) {
            foundReceipt = true
          }
        }
        if (!foundReceipt) {
          break
        }
        await DocumentFile.findOneAndUpdate({ _id: req.body.vehicleRegistration[i]._id }, req.body.vehicleRegistration[i])
      } else {
        var result = await (new DocumentFile(req.body.vehicleRegistration[i])).save()
        req.body.vehicleRegistration[i] = result._id
      }
    }
    req.user.vehicleRegistration = req.body.vehicleRegistration
    req.user.markModified('vehicleRegistration')
    try {
      const result = await req.user.save()
      return res.send({ message: i18n.t('alerts.successSaving'), result: result })
    } catch (error) {
      return res.status(400).send({ message: i18n.t('alerts.errorSaving'), error: error })
    }
  }
  return res.sendStatus(403)
})

router.get('/currency', getter(Currency, 'currency', 200))
router.get('/country', async (req, res) => {
  const select = {}
  if (!req.query.lumpSums) {
    select.lumpSums = 0
    select.lumpSumsFrom = 0
  }
  return getter(Country, 'country', 400, {}, select)(req, res)
})

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
  return getter(Travel, 'travel', 20, { traveler: req.user._id, historic: false }, select, sortFn)(req, res)
})

router.delete('/travel', deleter(Travel, 'traveler'))

router.post('/travel', async (req, res) => {
  req.body.editor = req.user._id
  delete req.body.state
  delete req.body.traveler
  delete req.body.history
  delete req.body.historic
  delete req.body.stages
  delete req.body.expenses
  delete req.body.professionalShare

  const check = async (oldObject) => {
    return oldObject.state !== 'refunded'
  }
  return setter(Travel, 'traveler', false, check)(req, res)
})

function postRecord(recordType) {
  return async (req, res) => {
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
          req.body.cost.receipts[i].owner = req.user._id
          req.body.cost.receipts[i].data = buffer
        }
      }
    }
    const travel = await Travel.findOne({ _id: req.body.travelId })
    delete req.body.travelId
    if (!travel || travel.historic || travel.state !== 'approved' || !travel.traveler._id.equals(req.user._id)) {
      return res.sendStatus(403)
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
    if (!travel || travel.historic || travel.state !== 'approved' || !travel.traveler._id.equals(req.user._id)) {
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
  if (file && req.user._id.equals(file.owner._id)) {
    res.setHeader('Content-Type', file.type);
    res.setHeader('Content-Length', file.data.length);
    return res.send(file.data)
  } else {
    return res.sendStatus(403)
  }
})

router.delete('/documentFile', async (req, res) => {
  const file = await DocumentFile.findOne({ _id: req.query.id })
  if (file && req.user._id.equals(file.owner._id)) {
    await DocumentFile.deleteOne({ _id: file._id })
    return res.send({ message: i18n.t('alerts.successDeleting') })
  } else {
    return res.sendStatus(403)
  }
})

router.post('/travel/appliedFor', async (req, res) => {
  req.body = {
    state: 'appliedFor',
    traveler: req.user._id,
    editor: req.user._id,
    comment: null,
    _id: req.body._id,
    name: req.body.name,
    reason: req.body.reason,
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    destinationPlace: req.body.destinationPlace,
    travelInsideOfEU: req.body.travelInsideOfEU,
    advance: req.body.advance,
    claimSpouseRefund: req.body.claimSpouseRefund,
    fellowTravelersNames: req.body.fellowTravelersNames
  }

  if (!req.body.name) {
    try {
      var date = new Date(req.body.startDate)
      req.body.name = req.body.destinationPlace.place + ' ' + i18n.t('monthsShort.' + date.getUTCMonth(), { lng: req.user.settings.language }) + ' ' + date.getUTCFullYear()
    } catch (error) {
      return res.status(400).send(error)
    }
  }

  const check = async (oldObject) => {
    return oldObject.state === 'appliedFor' || oldObject.state === 'rejected' || oldObject.state === 'approved'
  }
  return setter(Travel, 'traveler', true, check, mail.sendNotificationMail)(req, res)
})

router.post('/travel/underExamination', async (req, res) => {
  req.body = {
    state: 'underExamination',
    editor: req.user._id,
    comment: req.body.comment,
    _id: req.body._id
  }

  const check = async (oldObject) => {
    if (oldObject.state === 'approved') {
      await oldObject.saveToHistory()
      const receipts = []
      for (const stage of oldObject.stages) {
        if (stage.transport == 'ownCar') {
          if (receipts.length == 0) {
            for (const vr of req.user.vehicleRegistration) {
              const doc = (await DocumentFile.findOne({ _id: vr._id })).toObject()
              delete doc._id
              receipts.push(await DocumentFile.create(doc))
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
  return setter(Travel, 'traveler', false, check, mail.sendNotificationMail)(req, res)
})


router.get('/travel/report', async (req, res) => {
  const travel = await Travel.findOne({ _id: req.query.id, traveler: req.user._id, historic: false, state: 'refunded' })
  if (travel) {
    const report = await pdf.generateReport(travel)
    res.setHeader('Content-disposition', 'attachment; filename=' + travel.name + '.pdf');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', report.length);
    return res.send(new Buffer.from(report))
  } else {
    res.status(400).send({ message: 'No travel found' })
  }
})


module.exports = router
