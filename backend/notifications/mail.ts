import ejs from 'ejs'
import nodemailer from 'nodemailer'
import { Contact, User as IUser, Locale } from '../../common/types.js'
import { getConnectionSettings } from '../db.js'
import { genAuthenticatedLink } from '../helper.js'
import i18n from '../i18n.js'
import { mapSmtpConfig } from '../settingsValidator.js'
import { getMailTemplate } from '../templates/cache.js'

export async function getClient() {
  const connectionSettings = await getConnectionSettings()
  if (connectionSettings.smtp?.host) {
    return nodemailer.createTransport(mapSmtpConfig(connectionSettings.smtp))
  }
  throw new Error('SMTP not configured in Connection Settings')
}

export async function sendMail(
  recipients: Array<Contact & { fk: IUser['fk']; settings: { language: IUser['settings']['language'] } }>,
  subject: string,
  paragraph: string,
  button?: { text: string; link: string },
  lastParagraph?: string | string[],
  authenticateLink = true
) {
  const mailPromises = []
  for (const recipient of recipients) {
    const language = recipient.settings.language
    let recipientButton: { text: string; link: string } | undefined = undefined
    if (button) {
      recipientButton = { ...button }
      if (authenticateLink && recipient.fk.magiclogin && recipientButton.link.startsWith(process.env.VITE_FRONTEND_URL)) {
        recipientButton.link = await genAuthenticatedLink({
          destination: recipient.fk.magiclogin,
          redirect: recipientButton.link.substring(process.env.VITE_FRONTEND_URL.length)
        })
      }
    }
    mailPromises.push(_sendMail(recipient, subject, paragraph, language, recipientButton, lastParagraph))
  }
  return await Promise.allSettled(mailPromises)
}

async function _sendMail(
  recipient: Contact,
  subject: string,
  paragraph: string,
  language: Locale,
  button?: { text: string; link: string },
  lastParagraph?: string | string[]
) {
  const mailClient = await getClient()
  const salutation = i18n.t('mail.hiX', { lng: language, X: recipient.name.givenName })
  const regards = i18n.t('mail.regards', { lng: language })
  const app = {
    name: `${i18n.t('headlines.title', { lng: language })} ${i18n.t('headlines.emoji', { lng: language })}`,
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
  const plainText = `${salutation}\n\n${paragraph}\n\n${button ? `${button.text}: ${button.link}\n\n` : ''}${lastParagraph ? `${Array.isArray(lastParagraph) ? lastParagraph.join('\n') : lastParagraph}\n\n` : ''}${regards}\n\n${app.name}: ${app.url}`

  return await mailClient.sendMail({
    from: `"${app.name}" <${mailClient.options.from}>`, // sender address
    to: recipient.email, // list of receivers
    subject: subject, // Subject line
    text: plainText, // plain text body
    html: renderedHTML // html body
  })
}
