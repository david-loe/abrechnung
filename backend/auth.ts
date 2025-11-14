import { User as IUser } from 'abrechnung-common/types.js'
import express from 'express'
import { Types } from 'mongoose'
import passport from 'passport'
import User from './models/user.js'

const router = express.Router()

passport.serializeUser(async (user: IUser, cb) => {
  cb(null, { _id: user._id })
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
