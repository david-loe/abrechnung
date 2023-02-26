const router = require('express').Router()
const User = require('../models/user')
const i18n = require('../i18n')
const helper = require('../helper')

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
    if (!user) {
        var mail = req.user[process.env.LDAP_MAIL_ATTRIBUTE]
        if (Array.isArray(mail)) {
            if (mail.length > 0) {
                mail = mail[0]
            } else {
                mail = ""
            }
        }
        user = new User({ uid: req.user[process.env.LDAP_UID_ATTRIBUTE], mail: mail })
        try {
            await user.save()
        } catch (error) {
            return res.status(400).send({ message: "Error while creating User" })
        }
    }
    res.send({data: Object.assign(user, {name: req.user[process.env.LDAP_DISPLAYNAME_ATTRIBUTE]})})
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


module.exports = router
