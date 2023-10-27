import express from 'express'
import mongoose, { ObjectId } from 'mongoose'
import cors from 'cors'
import passport from 'passport'
import LdapStrategy from 'passport-ldapauth'
import { Strategy as MicrosoftStrategy } from 'passport-microsoft'
import session from 'express-session'
import MongoStore from 'connect-mongo'
import initDB from './initdb.js'
import i18n from './i18n.js'
import User from './models/user.js'
import routes from './routes/api/routes.js'
import uploadRoutes from './routes/upload/routes.js'
import { MongoClient } from 'mongodb'
import { User as IUser } from '../common/types.js'

await mongoose.connect(process.env.MONGO_URL, {})
console.log(i18n.t('alerts.db.success'))

await initDB()

const useLDAP = process.env.VITE_AUTH_USE_LDAP.toLocaleLowerCase() === 'true'
const useMicrosoft = process.env.VITE_AUTH_USE_MS_AZURE.toLocaleLowerCase() === 'true'

// Get LDAP credentials from ENV
if (useLDAP) {
  passport.use(
    new LdapStrategy(
      {
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
      },
      async function (ldapUser: any, cb: (error: any, user?: any) => void) {
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
          cb(null, user)
        } catch (error) {
          cb(error)
        }
      }
    )
  )
}

if (useMicrosoft) {
  passport.use(
    new MicrosoftStrategy(
      {
        clientID: process.env.MS_AZURE_CLIENT_ID,
        clientSecret: process.env.MS_AZURE_CLIENT_SECRET,
        callbackURL: process.env.VITE_BACKEND_URL + '/auth/microsoft/callback',
        tenant: process.env.MS_AZURE_TENANT,
        scope: ['user.read']
      },
      async function (accessToken: string, refreshToken: string, profile: any, verified: (error: any, user?: Express.User) => void) {
        // TODO MS profile to User mapping
        console.log(profile)
      }
    )
  )
}

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

passport.serializeUser(async (user: IUser, cb) => {
  cb(null, { _id: user._id })
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

if (useLDAP) {
  app.post('/auth/ldapauth', passport.authenticate('ldapauth', { session: true }), async (req, res) => {
    res.send({ status: 'ok' })
  })
}

if (useMicrosoft) {
  app.get('/auth/microsoft', passport.authenticate('microsoft'))
  app.get('/auth/microsoft/callback', passport.authenticate('microsoft'))
}

app.use('/api', routes)
app.use('/upload', uploadRoutes)

export default app
