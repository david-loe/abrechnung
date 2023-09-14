import express, { NextFunction, Request, Response } from 'express'
import mongoose, { ObjectId } from 'mongoose'
import cors from 'cors'
import passport from 'passport'
import LdapStrategy from 'passport-ldapauth'
import session from 'express-session'
import MongoStore from 'connect-mongo'
import initDB from './initdb.js'
import i18n from './i18n.js'
import User from './models/user.js'
import routes from './routes/api/routes.js'
import adminRoutes from './routes/api/admin/routes.js'
import approveRoutes from './routes/api/approve/routes.js'
import examineRoutes from './routes/api/examine/routes.js'
import uploadRoutes from './routes/upload/routes.js'
import { Access } from '../common/types.js'
import { MongoClient } from 'mongodb'

await mongoose.connect(process.env.MONGO_URL, {})
console.log(i18n.t('alerts.db.success'))

await initDB()

// Get LDAP credentials from ENV
passport.use(
  new LdapStrategy({
    server: {
      url: process.env.LDAP_URL,
      bindDN: process.env.LDAP_BINDDN,
      bindCredentials: process.env.LDAP_BINDCREDENTIALS,
      searchBase: process.env.LDAP_SEARCHBASE,
      searchFilter: process.env.LDAP_SEARCHFILTER,
      tlsOptions: {
        requestCert: process.env.LDAP_TLS_REQUESTCERT.toLowerCase() === 'true',
        rejectUnauthorized: process.env.LDAP_TLS_REJECTUNAUTHORIZED.toLowerCase() === 'true'
      }
    }
  })
)

const app = express()

app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ limit: '2mb', extended: true }))
app.use(
  cors({
    credentials: true,
    origin: process.env.VITE_FRONTEND_URL
  })
)

app.use(
  session({
    store: MongoStore.create({ client: mongoose.connection.getClient() as unknown as MongoClient }),
    secret: process.env.COOKIE_SECRET ? process.env.COOKIE_SECRET : 'secret',
    cookie: {
      maxAge: 2 * 24 * 60 * 60 * 1000,
      secure: false,
      sameSite: 'strict'
    },
    resave: true,
    saveUninitialized: false,
    name: i18n.t('headlines.title')
  })
)

passport.serializeUser(async (ldapUser: any, cb) => {
  var user = await User.findOne({ uid: ldapUser[process.env.LDAP_UID_ATTRIBUTE] })
  var email = ldapUser[process.env.LDAP_MAIL_ATTRIBUTE]
  if (Array.isArray(email)) {
    if (email.length > 0) {
      email = email[0]
    } else {
      email = undefined
    }
  }
  var name = ldapUser[process.env.LDAP_DISPLAYNAME_ATTRIBUTE]
  if (!name) {
    name = ldapUser[process.env.LDAP_UID_ATTRIBUTE]
  }
  const newUser = {
    uid: ldapUser[process.env.LDAP_UID_ATTRIBUTE],
    email: email,
    name: name
  }
  if (!user) {
    user = new User(newUser)
  } else {
    Object.assign(user, newUser)
  }
  try {
    await user.save()
    cb(null, { _id: user._id })
  } catch (error) {
    cb(error)
  }
})

passport.deserializeUser(async (sessionUser: { _id: ObjectId }, cb) => {
  const user = await User.findOne({ _id: sessionUser._id })
  if (user) {
    cb(null, user)
  } else {
    cb(new Error('No User found with id: ' + sessionUser._id))
  }
})

app.use(passport.initialize())
app.use(passport.session())

app.post('/login', passport.authenticate('ldapauth', { session: true }), async (req, res) => {
  res.send({ status: 'ok' })
})

app.use('/api', async (req, res, next) => {
  if (req.isAuthenticated()) {
    next()
  } else {
    return res.status(401).send({ message: i18n.t('alerts.request.unauthorized') })
  }
})

function accessControl(access: Access) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user!.access[access]) {
      next()
    } else {
      return res.status(403).send({ message: i18n.t('alerts.request.unauthorized') })
    }
  }
}

app.use('/api', routes)
app.use('/upload', uploadRoutes)
app.use('/api/admin', accessControl('admin'))
app.use('/api/admin', adminRoutes)
app.use('/api/approve', accessControl('approve'))
app.use('/api/approve', approveRoutes)
app.use('/api/examine', accessControl('examine'))
app.use('/api/examine', examineRoutes)

export default app
