const helper = require('../helper')
const User = require('../models/user')
const router = require('express').Router()

router.get('/user', helper.getter(User, 'user', 100))
router.post('/user', helper.setter(User, '', true))
router.delete('/user', helper.deleter(User))

module.exports = router