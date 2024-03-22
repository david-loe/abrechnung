import express from 'express'
import { Types } from 'mongoose'
import passport from 'passport'
import { User as IUser } from '../common/types.js'
import ldapauth from './authStrategies/ldapauth.js'
import magicLogin from './authStrategies/magiclogin.js'
import microsoft from './authStrategies/microsoft.js'
import User from './models/user.js'
const router = express.Router()

passport.use(ldapauth)
passport.use(microsoft)
passport.use(magicLogin)

passport.serializeUser(async (user: IUser, cb) => {
  cb(null, { _id: user._id })
})

passport.deserializeUser(async (sessionUser: { _id: Types.ObjectId }, cb) => {
  const user = await User.findOne({ _id: sessionUser._id })
  if (user) {
    cb(null, user)
  } else {
    cb(new Error('No User found with id: ' + sessionUser._id))
  }
})

router.use(passport.initialize())
router.use(passport.session())

export default router
