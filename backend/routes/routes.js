const router = require('express').Router()
const User = require('../models/user')
const i18n = require('../i18n')
const helper = require('../helper')
const Travel = require('../models/travel')

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

router.get('/travel', async (req, res) => {
  const user = await User.findOne({ uid: req.user[process.env.LDAP_UID_ATTRIBUTE] })
  return helper.getter(Travel, 'travel', 20, { traveler: user._id, historic: false }, { history: 0 })(req, res)
})

router.post('/travel', async (req, res) => {
  const user = await User.findOne({ uid: req.user[process.env.LDAP_UID_ATTRIBUTE] })
  req.body.editor = user._id
  delete req.body.state
  delete req.body.traveler
  delete req.body.history
  delete req.body.historic

  const check = async (oldObject) => {
    return oldObject.state !== 'refunded'
  }
  return helper.setter(Travel, 'traveler', false, check)(req, res)
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
    return oldObject.state === 'appliedFor'
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
    await oldObject.saveToHistory()
    await oldObject.save()
    return oldObject.state === 'approved'
  }
  return helper.setter(Travel, 'traveler', false, check)(req, res)
})


module.exports = router
