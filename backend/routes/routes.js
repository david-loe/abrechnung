const router = require('express').Router()
const User = require('../models/user')
const i18n = require('../i18n')
const helper = require('../helper')
const Travel = require('../models/travel')
const Currency = require('../models/currency')
const Country = require('../models/country')

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
  const select = {history: 0, historic: 0}
  if(!req.query.records){
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

router.post('/travel/record', async (req, res) => {
  const travel = await Travel.findOne({ _id: req.body.travelId })
  delete req.body.travelId
  var user = await User.findOne({ uid: req.user[process.env.LDAP_UID_ATTRIBUTE] })
  if (!travel || travel.historic || travel.state !== 'approved' || !travel.traveler._id.equals(user._id)) {
    return res.sendStatus(403)
  }
  if (req.body._id && req.body._id !== '') {
    var found = false
    for(const record in travel.records){
      if(record._id.equals(req.body._id)){
        found = true
        Object.assign(record, req.body)
        break
      }
    }
    if(!found){
      return res.sendStatus(403)
    }
  } else {
    travel.records.push(req.body)
  }
  travel.markModified('records')
  try {
    const result = await travel.save()
    res.send({ message: i18n.t('alerts.successSaving'), result: result })
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
