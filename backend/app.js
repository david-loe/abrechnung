import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import passport from 'passport'
import LdapStrategy from 'passport-ldapauth'
import session from 'express-session'
import MongoStore from 'connect-mongo'
import initDB from './initdb'
import i18n from './i18n'
import User from './models/user'
import routes from './routes/routes'
import adminRoutes from './routes/admin'
import approveRoutes from './routes/approve'
import examineRoutes from './routes/examine'
import uploadRoutes from './routes/upload'

const port = process.env.BACKEND_PORT
const url = process.env.VITE_BACKEND_URL

const mongoClientPromise = mongoose.connect(process.env.MONGO_URL, {}).then(() => {
  console.log(i18n.t('alerts.db.success'))
})
initDB()

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
        rejectUnauthorized: process.env.LDAP_TLS_REJECTUNAUTHORIZED.toLowerCase() === 'true',
      },
    },
  }),
)

const app = express()

app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ limit: '2mb', extended: true }))
app.use(
  cors({
    credentials: true,
    origin: process.env.VITE_FRONTEND_URL,
  }),
)

app.use(
  session({
    store: MongoStore.create({ client: mongoose.connection.getClient() }),
    secret: process.env.COOKIE_SECRET ? process.env.COOKIE_SECRET : 'secret',
    cookie: {
      maxAge: 2 * 24 * 60 * 60 * 1000,
      secure: false,
      sameSite: 'strict',
    },
    resave: true,
    saveUninitialized: false,
    name: i18n.t('headlines.title')
  }),
)

passport.serializeUser(async (ldapUser, cb) => {
  var user = await User.findOne({ uid: ldapUser[process.env.LDAP_UID_ATTRIBUTE] })
  var email = ldapUser[process.env.LDAP_MAIL_ATTRIBUTE]
  if (Array.isArray(email)) {
    if (email.length > 0) {
      email = email[0]
    } else {
      email = undefined
    }
  }
  const newUser = {
    uid: ldapUser[process.env.LDAP_UID_ATTRIBUTE],
    email: email,
    name: ldapUser[process.env.LDAP_DISPLAYNAME_ATTRIBUTE],
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

passport.deserializeUser(async (sessionUser, cb) => {
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

User.find({}).then(async (docs) => {
  if (docs.length === 0) {
    const admin = new User({ uid: process.env.ADMIN_UID, access: { admin: true } })
    await admin.save()
    console.log('Added Admin User')
  }
})

app.use('/api', async (req, res, next) => {
  if (req.isAuthenticated()) {
    next()
  } else {
    return res.status(401).send({ message: i18n.t('alerts.request.unauthorized') })
  }
})

app.use('/api', routes)

function accessControl(access) {
  return (req, res, next) => {
    if (req.user.access[access]) {
      next()
    } else {
      return res.status(403).send({ message: i18n.t('alerts.request.unauthorized') })
    }
  }
}
app.use('/api/admin', accessControl('admin'))
app.use('/api/admin', adminRoutes)
app.use('/api/approve', accessControl('approve'))
app.use('/api/approve', approveRoutes)
app.use('/api/examine', accessControl('examine'))
app.use('/api/examine', examineRoutes)

app.use('/upload', uploadRoutes)

export default app
