import LdapAuth from 'ldapauth-fork'
import LdapStrategy from 'passport-ldapauth'
import { ldapauthSettings } from '../../common/types.js'
import User from '../models/user.js'
import { AuthenticationStrategy, NewUser, addAdminIfNone } from './index.js'

class Ldapauth extends AuthenticationStrategy<LdapStrategy, ldapauthSettings> {
  #mapConfig(config: ldapauthSettings): LdapStrategy.Options['server'] {
    return {
      url: config.url,
      bindDN: config.bindDN,
      bindCredentials: config.bindCredentials,
      searchBase: config.searchBase,
      searchFilter: config.searchFilter,
      tlsOptions: {
        rejectUnauthorized: config.tlsOptions.rejectUnauthorized
      }
    }
  }
  configureStrategy(config: ldapauthSettings) {
    this.strategy = new LdapStrategy(
      {
        server: this.#mapConfig(config)
      },
      async function (ldapUser: any, cb: (error: any, user?: any) => void) {
        let user = await User.findOne({ 'fk.ldapauth': ldapUser[config.uidAttribute] })
        let email = ldapUser[config.mailAttribute]
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
          fk: { ldapauth: ldapUser[config.uidAttribute] },
          email: email,
          name: { familyName: ldapUser[config.familyNameAttribute], givenName: ldapUser[config.givenNameAttribute] }
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
  }
  verifyConfig(config: ldapauthSettings) {
    return new Promise((resolve, reject) => {
      try {
        const ldapAuthInstance = new LdapAuth(this.#mapConfig(config))
        const adminClient = (ldapAuthInstance as any)._adminClient
        const userClient = (ldapAuthInstance as any)._userClient
        ldapAuthInstance.on('error', reject)
        adminClient.on('error', reject)
        adminClient.on('connectTimeout', reject)
        adminClient.on('connectError', reject)
        userClient.on('error', reject)
        userClient.on('connectTimeout', reject)
        userClient.on('connectError', reject)

        adminClient.once('connect', () => {
          resolve(ldapAuthInstance)
        })
      } catch (err) {
        reject(err)
      }
    })
  }
}

export default new Ldapauth()
