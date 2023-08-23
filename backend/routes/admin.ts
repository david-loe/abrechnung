import { getter, setter, deleter } from '../helper.js'
import User from '../models/user.js'
import express from 'express'
const router = express.Router()

router.get('/user', getter(User, 'user', 100))
router.post('/user', setter(User, '', true))
router.delete('/user', deleter(User))

export default router
