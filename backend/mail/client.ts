import nodemailer from 'nodemailer'
import { ConnectionSettings } from '../../common/types.js'

class Mail {
  #client: nodemailer.Transporter | undefined

  getClient() {
    if (!this.#client) {
      throw new Error('Mail client is not configured')
    }
    return this.#client
  }

  configureClient(config: ConnectionSettings['smtp']) {
    this.#client = this.#createClient(config)
  }

  async verifyConfig(config: ConnectionSettings['smtp']) {
    const testClient = this.#createClient(config)
    await testClient.verify()
  }

  #createClient(config: ConnectionSettings['smtp']) {
    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password
      },
      from: config.senderAddress,
      dnsTimeout: 1500
    })
  }
}

export default new Mail()
