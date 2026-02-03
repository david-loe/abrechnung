import { ldapauthSettings, smtpSettings } from 'abrechnung-common/types.js'
import ldap from 'ldapjs'
import nodemailer from 'nodemailer'
import SMTPConnection from 'nodemailer/lib/smtp-connection/index.js'
import SMTPTransport from 'nodemailer/lib/smtp-transport/index.js'
import LdapStrategy from 'passport-ldapauth'

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
    tlsOptions: { rejectUnauthorized: config.tlsOptions.rejectUnauthorized }
  }
}

export function mapSmtpConfig(config: smtpSettings): SMTPTransport.Options {
  let auth: SMTPConnection.AuthenticationType | undefined
  if (config.auth.authType === 'Login') {
    auth = { user: config.auth.user, pass: config.auth.pass, type: 'login' }
  } else if (config.auth.authType === 'OAuth2') {
    auth = {
      user: config.auth.user,
      clientId: config.auth.clientId,
      clientSecret: config.auth.clientSecret,
      refreshToken: config.auth.refreshToken,
      accessToken: config.auth.accessToken,
      accessUrl: config.auth.accessUrl,
      privateKey: config.auth.privateKey,
      expires: config.auth.expires,
      timeout: config.auth.timeout,
      serviceClient: config.auth.serviceClient,
      type: 'OAuth2'
    }
  }
  return { host: config.host, port: config.port, secure: config.secure, auth, from: config.senderAddress, dnsTimeout: 1_500 }
}
