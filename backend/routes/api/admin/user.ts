import { getter, setter, deleter } from '../../../helper.js'
import User from '../../../models/user.js'
import express from 'express'
const router = express.Router()

router.get('/', getter(User, 'user', 100))
router.post('/', setter(User, '', true))
router.delete('/', deleter(User))

export default router
