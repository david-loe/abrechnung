import { getter, setter, deleter } from '../helper'
import User from '../models/user'
import express from 'express'
const router = express.Router()

router.get('/user', getter(User, 'user', 100))
router.post('/user', setter(User, '', true))
router.delete('/user', deleter(User))

module.exports = router