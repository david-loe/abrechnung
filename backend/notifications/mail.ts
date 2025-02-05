import ejs from 'ejs'
import nodemailer from 'nodemailer'
import { User as IUser, Locale } from '../../common/types.js'
import { getConnectionSettings } from '../db.js'
import { genAuthenticatedLink } from '../helper.js'
import i18n from '../i18n.js'
import { mapSmtpConfig } from '../settingsValidator.js'
import { getMailTemplate } from '../templates/cache.js'

export async function getClient() {
  const connectionSettings = await getConnectionSettings()
  if (connectionSettings.smtp?.host) {
    return nodemailer.createTransport(mapSmtpConfig(connectionSettings.smtp))
  } else {
    throw new Error('SMTP not configured in Connection Settings')
  }
}

export async function sendMail(
  recipients: IUser[],
  subject: string,
  paragraph: string,
  button?: { text: string; link: string },
  lastParagraph?: string,
  authenticateLink = true
) {
  const mailPromises = []
  for (let i = 0; i < recipients.length; i++) {
    const language = recipients[i].settings.language
    let recipientButton: { text: string; link: string } | undefined = undefined
    if (button) {
      recipientButton = { ...button }
      if (authenticateLink && recipients[i].fk.magiclogin && recipientButton.link.startsWith(process.env.VITE_FRONTEND_URL)) {
        recipientButton.link = await genAuthenticatedLink({
          destination: recipients[i].fk.magiclogin!,
          redirect: recipientButton.link.substring(process.env.VITE_FRONTEND_URL.length)
        })
      }
    }
    mailPromises.push(_sendMail(recipients[i], subject, paragraph, language, recipientButton, lastParagraph))
  }
  return await Promise.allSettled(mailPromises)
}

async function _sendMail(
  recipient: IUser,
  subject: string,
  paragraph: string,
  language: Locale,
  button?: { text: string; link: string },
  lastParagraph?: string
) {
  const mailClient = await getClient()
  const salutation = i18n.t('mail.hiX', { lng: language, X: recipient.name.givenName })
  const regards = i18n.t('mail.regards', { lng: language })
  const app = {
    name: i18n.t('headlines.title', { lng: language }) + ' ' + i18n.t('headlines.emoji', { lng: language }),
    url: process.env.VITE_FRONTEND_URL
  }

  const template = await getMailTemplate()
  const renderedHTML = ejs.render(template, {
    salutation,
    paragraph,
    button,
    lastParagraph,
    regards,
    app
  })
  const plainText =
    salutation +
    '\n\n' +
    paragraph +
    '\n\n' +
    (button ? button.text + ': ' + button.link + '\n\n' : '') +
    lastParagraph +
    '\n\n' +
    regards +
    '\n\n' +
    app.name +
    ': ' +
    app.url

  return await mailClient.sendMail({
    from: '"' + app.name + '" <' + mailClient.options.from + '>', // sender address
    to: recipient.email, // list of receivers
    subject: subject, // Subject line
    text: plainText, // plain text body
    html: renderedHTML // html body
  })
}
