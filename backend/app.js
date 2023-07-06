const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const passport = require('passport')
const LdapStrategy = require('passport-ldapauth')
const session = require('express-session')
const MongoStore = require('connect-mongo')
const i18n = require('./i18n')
const User = require('./models/user')

const port = process.env.BACKEND_PORT
const url = process.env.VITE_BACKEND_URL

const mongoClientPromise = mongoose.connect(process.env.MONGO_URL, {}).then(() => {
  console.log(i18n.t('alerts.db.success'))
})
require('./initdb')

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
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: false,
      sameSite: 'strict',
    },
    resave: false,
    saveUninitialized: true,
  }),
)

passport.serializeUser(function (user, done) {
  done(null, user)
})

passport.deserializeUser(function (user, done) {
  done(null, user)
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
const routes = require('./routes/routes')
app.use('/api', routes)

const accesses = Object.keys(User.schema.tree.access)
for (const access of accesses) {
  app.use('/api/' + access, async (req, res, next) => {
    const user = await User.findOne({ uid: req.user[process.env.LDAP_UID_ATTRIBUTE] })
    if (user && user.access[access]) {
      next()
    } else {
      return res.status(403).send({ message: i18n.t('alerts.request.unauthorized') })
    }
  })
  const adminRoutes = require('./routes/' + access)
  app.use('/api/' + access, adminRoutes)
}

module.exports = app
