import LdapAuth from 'ldapauth-fork'
import nodemailer from 'nodemailer'
import SMTPTransport from 'nodemailer/lib/smtp-transport/index.js'
import LdapStrategy from 'passport-ldapauth'
import { ldapauthSettings, smtpSettings } from '../common/types.js'

export function verifyLdapauthConfig(config: ldapauthSettings) {
  return new Promise<true>((resolve, reject) => {
    try {
      const ldapAuthInstance = new LdapAuth(mapLdapauthConfig(config))
      const adminClient = (ldapAuthInstance as any)._adminClient
      const userClient = (ldapAuthInstance as any)._userClient
      const errorHandler = (err: Error) => {
        cleanup()
        reject(err)
      }
      ldapAuthInstance.on('error', errorHandler)
      adminClient.on('error', errorHandler)
      adminClient.on('connectTimeout', errorHandler)
      adminClient.on('connectError', errorHandler)
      userClient.on('error', errorHandler)
      userClient.on('connectTimeout', errorHandler)
      userClient.on('connectError', errorHandler)
      function cleanup() {
        ldapAuthInstance.removeListener('error', errorHandler)
        adminClient.removeAllListeners()
        userClient.removeAllListeners()
        ldapAuthInstance.close()
      }

      adminClient.once('connect', () => {
        cleanup()
        resolve(true)
      })
    } catch (err) {
      reject(err)
    }
  })
}

export function verifySmtpConfig(config: smtpSettings) {
  const testClient = nodemailer.createTransport(mapSmtpConfig(config))
  return testClient.verify()
}

export function mapLdapauthConfig(config: ldapauthSettings): LdapStrategy.Options['server'] {
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

export function mapSmtpConfig(config: smtpSettings): SMTPTransport.Options {
  return {
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password
    },
    from: config.senderAddress,
    dnsTimeout: 1500
  }
}
