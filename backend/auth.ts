import passport from 'passport'
import LdapStrategy from 'passport-ldapauth'
import { Strategy as MicrosoftStrategy } from 'passport-microsoft'
import User from './models/user.js'
import { UserSimple, User as IUser } from '../common/types.js'
import { HydratedDocument, ObjectId } from 'mongoose'
import express from 'express'
const router = express.Router()

const useLDAP = process.env.VITE_AUTH_USE_LDAP.toLocaleLowerCase() === 'true'
const useMicrosoft = process.env.VITE_AUTH_USE_MS_AZURE.toLocaleLowerCase() === 'true'

interface NewUser extends Omit<UserSimple, '_id'> {
  fk?: IUser['fk']
}
function addAdminIfNone(user: HydratedDocument<IUser>) {
  User.find({ 'access.admin': true }).then((docs) => {
    if (docs.length == 0) {
      user.access.admin = true
      user.markModified('access')
      user.save()
    }
  })
}
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
        var user = await User.findOne({ 'fk.ldapauth': ldapUser[process.env.LDAP_UID_ATTRIBUTE] })
        var email = ldapUser[process.env.LDAP_MAIL_ATTRIBUTE]
        if (Array.isArray(email)) {
          if (email.length > 0) {
            email = email[0]
          } else {
            email = undefined
          }
        }
        if (!user && email) {
          user = await User.findOne({ email: email })
        }
        const newUser: NewUser = {
          fk: { ldapauth: ldapUser[process.env.LDAP_UID_ATTRIBUTE] },
          email: email,
          name: { familyName: ldapUser[process.env.LDAP_SURNAME_ATTRIBUTE], givenName: ldapUser[process.env.LDAP_GIVENNAME_ATTRIBUTE] }
        }
        if (!user) {
          user = new User(newUser)
        } else {
          Object.assign(user.fk, newUser.fk)
          delete newUser.fk
          Object.assign(user, newUser)
        }
        try {
          await user.save()
          addAdminIfNone(user)
          cb(null, user)
        } catch (error) {
          cb(error)
        }
      }
    )
  )
}

interface msProfile {
  provider: 'microsoft'
  name: { familyName: string; givenName: string }
  id: string
  displayName: string
  emails: { type: string; value: string }[]
  _raw: string
  _json: {
    '@odata.context': string
    businessPhones: string[]
    displayName: string
    givenName: string
    jobTitle: string | null
    mail: string
    mobilePhone: string | null
    officeLocation: string | null
    preferredLanguage: string | null
    surname: string
    userPrincipalName: string
    id: string
  }
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
      async function (accessToken: string, refreshToken: string, profile: msProfile, verified: (error: any, user?: Express.User) => void) {
        var user = await User.findOne({ 'fk.microsoft': profile._json.id })
        var email = profile._json.mail
        if (!user && email) {
          user = await User.findOne({ email: email })
        }
        const newUser: NewUser = {
          fk: { microsoft: profile._json.id },
          email: email,
          name: { familyName: profile._json.surname, givenName: profile._json.givenName }
        }
        if (!user) {
          user = new User(newUser)
        } else {
          Object.assign(user.fk, newUser.fk)
          delete newUser.fk
          Object.assign(user, newUser)
        }
        try {
          await user.save()
          verified(null, user)
          addAdminIfNone(user)
        } catch (error) {
          verified(error)
        }
      }
    )
  )
}

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

router.use(passport.initialize())
router.use(passport.session())

if (useLDAP) {
  router.post('/auth/ldapauth', passport.authenticate('ldapauth', { session: true }), async (req, res) => {
    res.send({ status: 'ok' })
  })
}

if (useMicrosoft) {
  router.get('/auth/microsoft', (req, res, next) => {
    const redirect = req.query.redirect
    const state = req.query.redirect ? Buffer.from(JSON.stringify({ redirect })).toString('base64') : undefined
    passport.authenticate('microsoft', { state: state })(req, res, next)
  })
  router.get('/auth/microsoft/callback', passport.authenticate('microsoft'), (req, res) => {
    try {
      const state = req.query.state as string
      const { redirect } = JSON.parse(Buffer.from(state, 'base64').toString())
      if (typeof redirect === 'string' && redirect.startsWith('/')) {
        return res.redirect(process.env.VITE_FRONTEND_URL + redirect)
      }
    } catch {
      // just redirect normally below
    }
    res.redirect(process.env.VITE_FRONTEND_URL)
  })
}

export default router
