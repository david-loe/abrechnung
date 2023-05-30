const helper = require('../helper')
const router = require('express').Router()
const File = require('../models/file')
const Travel = require('../models/travel')


router.get('/travel', async (req, res) => {
  const sortFn = (a, b) => a.startDate - b.startDate
  const select = { history: 0, historic: 0 }
  if (!req.query.records) {
    select.records = 0
  }
  if (!req.query.days) {
    select.days = 0
  }
  return helper.getter(Travel, 'travel', 20, { state: 'underExamination', historic: false }, select, sortFn)(req, res)
})

router.get('/travel/refunded', async (req, res) => {
  const sortFn = (a, b) => a.startDate - b.startDate
  const select = { history: 0, historic: 0 }
  if (!req.query.records) {
    select.records = 0
  }
  if (!req.query.days) {
    select.days = 0
  }
  return helper.getter(Travel, 'travel', 20, { state: 'refunded', historic: false }, select, sortFn)(req, res)
})

router.get('/travel/record/receipt', async (req, res) => {
  const file = await File.findOne({ _id: req.query.id })
  if (file) {
    res.setHeader('Content-Type', file.type);
    res.setHeader('Content-Length', file.data.length);
    return res.send(file.data)
  } else {
    return res.status(400).send({ message: 'No record found' })
  }
})

module.exports = router