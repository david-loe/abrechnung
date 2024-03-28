import mongoose from 'mongoose'
import LdapStrategy from 'passport-ldapauth'
import { Settings } from '../../common/types.js'
import User from '../models/user.js'
import { NewUser, addAdminIfNone } from './index.js'

const ldapauth = new LdapStrategy(
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
    let user = await User.findOne({ 'fk.ldapauth': ldapUser[process.env.LDAP_UID_ATTRIBUTE] })
    let email = ldapUser[process.env.LDAP_MAIL_ATTRIBUTE]
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
    const defaultAccess: Settings['defaultAccess'] = ((await mongoose.connection.collection('settings').findOne({})) as Settings)
      .defaultAccess
    const newUser: NewUser = {
      fk: { ldapauth: ldapUser[process.env.LDAP_UID_ATTRIBUTE] },
      email: email,
      name: { familyName: ldapUser[process.env.LDAP_SURNAME_ATTRIBUTE], givenName: ldapUser[process.env.LDAP_GIVENNAME_ATTRIBUTE] },
      access: defaultAccess
    }
    if (!user) {
      user = new User(newUser)
    } else {
      Object.assign(user.fk, newUser.fk)
      delete newUser.fk
      delete newUser.access
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

export default ldapauth
