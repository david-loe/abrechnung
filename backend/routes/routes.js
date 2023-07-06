const router = require('express').Router()
const multer = require('multer')
const fileHandler = multer({ limits: { fileSize: 16000000 } })
const User = require('../models/user')
const i18n = require('../i18n')
const helper = require('../helper')
const Travel = require('../models/travel')
const Currency = require('../models/currency')
const Country = require('../models/country')
const DocumentFile = require('../models/documentFile')
const mail = require('../mail/mail')
const pdf = require('../pdf/generate')

router.delete('/logout', function (req, res) {
  req.logout(function (err) {
    if (err) {
      res.status(400).send({ error: err })
    }
  })
  res.send({ status: 'ok' })
})

router.get('/user', async (req, res) => {
  var user = await User.findOne({ uid: req.user[process.env.LDAP_UID_ATTRIBUTE] })
  var email = req.user[process.env.LDAP_MAIL_ATTRIBUTE]
  if (Array.isArray(email)) {
    if (email.length > 0) {
      email = email[0]
    } else {
      email = undefined
    }
  }
  const ldapUser = {
    uid: req.user[process.env.LDAP_UID_ATTRIBUTE],
    email: email,
    name: req.user[process.env.LDAP_DISPLAYNAME_ATTRIBUTE],
  }
  if (!user) {
    user = new User(ldapUser)
  } else {
    Object.assign(user, ldapUser)
  }
  try {
    res.send({ data: await user.save() })
  } catch (error) {
    return res.status(400).send({ message: "Error while creating User" })
  }

})


router.post('/user/settings', async (req, res) => {
  const user = await User.findOne({ uid: req.user[process.env.LDAP_UID_ATTRIBUTE] })
  Object.assign(user.settings, req.body)
  user.markModified('settings')
  try {
    const result = await user.save()
    res.send({ message: i18n.t('alerts.successSaving'), result: result.settings })
  } catch (error) {
    res.status(400).send({ message: i18n.t('alerts.errorSaving'), error: error })
  }
})

router.get('/currency', helper.getter(Currency, 'currency', 200))
router.get('/country', async (req, res) => {
  const select = {}
  if (!req.query.lumpSums) {
    select.lumpSums = 0
    select.lumpSumsFrom = 0
  }
  return helper.getter(Country, 'country', 400, {}, select)(req, res)
})

router.get('/travel', async (req, res) => {
  const user = await User.findOne({ uid: req.user[process.env.LDAP_UID_ATTRIBUTE] })
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
  return helper.getter(Travel, 'travel', 20, { traveler: user._id, historic: false }, select, sortFn)(req, res)
})

router.delete('/travel', helper.deleter(Travel, 'traveler'))

router.post('/travel', async (req, res) => {
  const user = await User.findOne({ uid: req.user[process.env.LDAP_UID_ATTRIBUTE] })
  req.body.editor = user._id
  delete req.body.state
  delete req.body.traveler
  delete req.body.history
  delete req.body.historic
  delete req.body.stages
  delete req.body.days
  delete req.body.expenses
  delete req.body.professionalShare

  const check = async (oldObject) => {
    return oldObject.state !== 'refunded'
  }
  return helper.setter(Travel, 'traveler', false, check)(req, res)
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
          req.body.cost.receipts[i].data = buffer
        }
      }
    }
    const travel = await Travel.findOne({ _id: req.body.travelId })
    delete req.body.travelId
    var user = await User.findOne({ uid: req.user[process.env.LDAP_UID_ATTRIBUTE] })
    if (!travel || travel.historic || travel.state !== 'approved' || !travel.traveler._id.equals(user._id)) {
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
    var user = await User.findOne({ uid: req.user[process.env.LDAP_UID_ATTRIBUTE] })
    if (!travel || travel.historic || travel.state !== 'approved' || !travel.traveler._id.equals(user._id)) {
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

function getRecordReceipt(recordType) {

  return async (req, res) => {
    const travel = await Travel.findOne({ _id: req.query.travelId })
    delete req.query.travelId
    var user = await User.findOne({ uid: req.user[process.env.LDAP_UID_ATTRIBUTE] })
    if (!travel || travel.historic || travel.state !== 'approved' || !travel.traveler._id.equals(user._id)) {
      return res.sendStatus(403)
    }
    if (req.query[recordType.replace(/s$/, '') + 'Id']) { // e.g. stageId
      var found = false
      outer_loop:
      for (var i = 0; i < travel[recordType].length; i++) {
        if (travel[recordType][i]._id.equals(req.query[recordType.replace(/s$/, '') + 'Id'])) { // e.g. stageId
          if (travel[recordType][i].cost) {
            for (var r = 0; r < travel[recordType][i].cost.receipts.length; r++) {
              if (req.query.id && travel[recordType][i].cost.receipts[r]._id.equals(req.query.id)) {
                found = true
                var file = await DocumentFile.findOne({ _id: req.query.id })
                res.setHeader('Content-Type', file.type);
                res.setHeader('Content-Length', file.data.length);
                return res.send(file.data)
              }
            }
          }
        }
      }
      if (!found) {
        return res.sendStatus(403)
      }
    } else {
      return res.status(400).send({ message: 'No stage found' })
    }
  }
}

router.get('/travel/stage/receipt', getRecordReceipt('stages'))
router.get('/travel/expense/receipt', getRecordReceipt('expenses'))

function deleteRecordReceipt(recordType) {
  return async (req, res) => {
    const travel = await Travel.findOne({ _id: req.query.travelId })
    delete req.query.travelId
    var user = await User.findOne({ uid: req.user[process.env.LDAP_UID_ATTRIBUTE] })
    if (!travel || travel.historic || travel.state !== 'approved' || !travel.traveler._id.equals(user._id)) {
      return res.sendStatus(403)
    }
    if (req.query[recordType.replace(/s$/, '') + 'Id']) {
      var found = false
      outer_loop:
      for (var i = 0; i < travel[recordType].length; i++) {
        if (travel[recordType][i]._id.equals(req.query[recordType.replace(/s$/, '') + 'Id'])) {
          if (travel[recordType][i].cost) {
            for (var r = 0; r < travel[recordType][i].cost.receipts.length; r++) {
              if (req.query.id && travel[recordType][i].cost.receipts[r]._id.equals(req.query.id)) {
                found = true
                await DocumentFile.deleteOne({ _id: req.query.id })
                travel[recordType][i].cost.receipts.splice(r, 1)
                break outer_loop
              }
            }
          }
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

router.delete('/travel/stage/receipt', deleteRecordReceipt('stages'))
router.delete('/travel/expense/receipt', deleteRecordReceipt('expenses'))

router.post('/travel/appliedFor', async (req, res) => {
  const user = await User.findOne({ uid: req.user[process.env.LDAP_UID_ATTRIBUTE] })
  req.body = {
    state: 'appliedFor',
    traveler: user._id,
    editor: user._id,
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
      req.body.name = req.body.destinationPlace.place + ' ' + i18n.t('monthsShort.' + date.getUTCMonth(), { lng: user.settings.language }) + ' ' + date.getUTCFullYear()
    } catch (error) {
      return res.status(400).send(error)
    }
  }

  const check = async (oldObject) => {
    return oldObject.state === 'appliedFor' || oldObject.state === 'rejected'
  }
  return helper.setter(Travel, 'traveler', true, check, mail.sendNotificationMail)(req, res)
})

router.post('/travel/underExamination', async (req, res) => {
  const user = await User.findOne({ uid: req.user[process.env.LDAP_UID_ATTRIBUTE] })
  req.body = {
    state: 'underExamination',
    editor: user._id,
    comment: req.body.comment,
    _id: req.body._id
  }

  const check = async (oldObject) => {
    if (oldObject.state === 'approved') {
      await oldObject.saveToHistory()
      await oldObject.save()
      return true
    } else {
      return false
    }
  }
  return helper.setter(Travel, 'traveler', false, check, mail.sendNotificationMail)(req, res)
})


router.get('/travel/report', async (req, res) => {
  const user = await User.findOne({ uid: req.user[process.env.LDAP_UID_ATTRIBUTE] })
  const travel = await Travel.findOne({ _id: req.query.id, traveler: user._id, historic: false, state: 'refunded' })
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
