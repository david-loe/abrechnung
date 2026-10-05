import express from 'express'
import { Types } from 'mongoose'
import passport from 'passport'
import User from './models/user.js'
import { recordUserActivity } from './userActivity.js'

const router = express.Router()

passport.serializeUser(async (user: Express.User, cb) => {
  try {
    if (await user.isActive()) await recordUserActivity(user, true)
    cb(null, { _id: user._id })
  } catch (error) {
    cb(error)
  }
})

passport.deserializeUser(async (sessionUser: { _id: Types.ObjectId }, cb) => {
  const user = await User.findOne({ _id: sessionUser._id })
  if (user) {
    cb(null, user)
  } else {
    cb(null, false)
  }
})

router.use(passport.initialize())
router.use(passport.session())

export default router
