import ldap from 'ldapjs'
import nodemailer from 'nodemailer'
import SMTPTransport from 'nodemailer/lib/smtp-transport/index.js'
import LdapStrategy from 'passport-ldapauth'
import { ldapauthSettings, smtpSettings } from '../common/types.js'

export function verifyLdapauthConfig(config: ldapauthSettings) {
  return new Promise<true>((resolve, reject) => {
    const client = ldap.createClient(mapLdapauthConfig(config))

    client.on('error', (err) => {
      client.destroy()
      reject(err)
    })

    client.bind(config.bindDN, config.bindCredentials, (err) => {
      if (err) {
        client.unbind()
        reject(err)
      } else {
        client.unbind()
        resolve(true)
      }
    })
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
