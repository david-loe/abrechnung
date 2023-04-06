const router = require('express').Router()
const multer  = require('multer')
const fileHandler = multer()
const User = require('../models/user')
const i18n = require('../i18n')
const helper = require('../helper')
const Travel = require('../models/travel')
const Currency = require('../models/currency')
const Country = require('../models/country')
const File = require('../models/file')

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

router.get('/travel', async (req, res) => {
  const user = await User.findOne({ uid: req.user[process.env.LDAP_UID_ATTRIBUTE] })
  const sortFn = (a, b) => a.startDate - b.startDate
  const select = { history: 0, historic: 0 }
  if (!req.query.records) {
    select.records = 0
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
  delete req.body.records

  const check = async (oldObject) => {
    return oldObject.state !== 'refunded'
  }
  return helper.setter(Travel, 'traveler', false, check)(req, res)
})

router.post('/travel/record', fileHandler.single('cost[receipt][data]'), async (req, res) => {
  if(req.body.cost && req.file){
    req.body.cost.receipt.data = req.file.buffer
  }
  const travel = await Travel.findOne({ _id: req.body.travelId })
  delete req.body.travelId
  var user = await User.findOne({ uid: req.user[process.env.LDAP_UID_ATTRIBUTE] })
  if (!travel || travel.historic || travel.state !== 'approved' || !travel.traveler._id.equals(user._id)) {
    return res.sendStatus(403)
  }
  if (req.body._id && req.body._id !== '') {
    var found = false
    for (const record of travel.records) {
      if (record._id.equals(req.body._id)) {
        if(req.body.cost && req.file){
          if(req.body.cost.receipt._id){
            if(!record.cost.receipt._id.equals(req.body.cost.receipt._id)){
            break
            }
            await File.findOneAndUpdate({ _id: req.body.cost.receipt._id }, req.body.cost.receipt)
          }else{
            req.body.cost.receipt = await (new File(req.body.cost.receipt)).save()
          }
        }
        found = true
        console.log(req.body)
        Object.assign(record, req.body)
        break
      }
    }
    if (!found) {
      return res.sendStatus(403)
    }
  } else {
    if(req.body.cost && req.file){
      req.body.cost.receipt = await (new File(req.body.cost.receipt)).save()
    }
    travel.records.push(req.body)
  }
  travel.records.sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
  travel.markModified('records')
  try {
    const result = await travel.save()
    res.send({ message: i18n.t('alerts.successSaving'), result: result })
  } catch (error) {
    res.status(400).send({ message: i18n.t('alerts.errorSaving'), error: error })
  }
})

router.delete('/travel/record', async (req, res) => {
  const travel = await Travel.findOne({ _id: req.query.travelId })
  delete req.query.travelId
  var user = await User.findOne({ uid: req.user[process.env.LDAP_UID_ATTRIBUTE] })
  if (!travel || travel.historic || travel.state !== 'approved' || !travel.traveler._id.equals(user._id)) {
    return res.sendStatus(403)
  }
  if (req.query.id && req.query.id !== '') {
    var found = false
    for (var i = 0; i < travel.records.length; i++) {
      if (travel.records[i]._id.equals(req.query.id)) {
        found = true
        travel.records.splice(i, 1)
        break
      }
    }
    if (!found) {
      return res.sendStatus(403)
    }
  } else {
    return res.status(400).send({ message: 'No record found' })
  }
  travel.markModified('records')
  try {
    await travel.save()
    res.send({ message: i18n.t('alerts.successDeleting') })
  } catch (error) {
    res.status(400).send({ message: i18n.t('alerts.errorSaving'), error: error })
  }
})

router.post('/travel/appliedFor', async (req, res) => {
  const user = await User.findOne({ uid: req.user[process.env.LDAP_UID_ATTRIBUTE] })
  req.body.state = 'appliedFor'
  req.body.editor = user._id
  req.body.traveler = user._id
  delete req.body.history
  delete req.body.historic
  delete req.body.records

  const check = async (oldObject) => {
    return oldObject.state === 'appliedFor' || oldObject.state === 'rejected'
  }
  return helper.setter(Travel, 'traveler', true, check)(req, res)
})

router.post('/travel/underExamination', async (req, res) => {
  const user = await User.findOne({ uid: req.user[process.env.LDAP_UID_ATTRIBUTE] })
  req.body.state = 'underExamination'
  req.body.editor = user._id
  delete req.body.traveler
  delete req.body.history
  delete req.body.historic

  const check = async (oldObject) => {
    if (oldObject.state === 'approved') {
      await oldObject.saveToHistory()
      await oldObject.save()
      return true
    } else {
      return false
    }

  }
  return helper.setter(Travel, 'traveler', false, check)(req, res)
})


module.exports = router
