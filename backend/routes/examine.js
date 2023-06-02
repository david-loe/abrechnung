const helper = require('../helper')
const router = require('express').Router()
const File = require('../models/file')
const Travel = require('../models/travel')
const User = require('../models/user')

router.get('/travel', async (req, res) => {
  const sortFn = (a, b) => a.startDate - b.startDate
  const select = { history: 0, historic: 0 }
  if (!req.query.stages) {
    select.stages = 0
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
  if (!req.query.days) {
    select.days = 0
  }
  return helper.getter(Travel, 'travel', 20, { state: 'refunded', historic: false }, select, sortFn)(req, res)
})

router.post('/travel/refunded', async (req, res) => {
  const user = await User.findOne({ uid: req.user[process.env.LDAP_UID_ATTRIBUTE] })
  req.body = {
      state: 'refunded',
      editor: user._id,
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
  return helper.setter(Travel, '', false, check)(req, res)
})

function getReceipt(){
  return async (req, res) => {
    const file = await File.findOne({ _id: req.query.id })
    if (file) {
      res.setHeader('Content-Type', file.type);
      res.setHeader('Content-Length', file.data.length);
      return res.send(file.data)
    } else {
      return res.status(400).send({ message: 'No file found' })
    }
  }
}

router.get('/travel/stage/receipt', getReceipt())
router.get('/travel/expence/receipt', getReceipt())

module.exports = router