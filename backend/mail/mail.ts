import mailClient from './client.js'
import i18n from '../i18n.js'
import ejs from 'ejs'
import fs from 'fs'
import User from '../models/user.js'
import { UserSimple, Travel } from '../../common/types.js'

export function sendMail(
  recipients: UserSimple[],
  subject: string,
  paragaph: string,
  button: { text: string; link: string },
  lastParagraph: string
) {
  if (mailClient == undefined || recipients.length === 0) {
    return false
  }
  var salutation = i18n.t('mail.hi')
  if (recipients.length === 1) {
    salutation = i18n.t('mail.hiX', { X: recipients[0].name })
  }
  const regards = i18n.t('mail.regards')
  const app = { name: i18n.t('headlines.title') + ' ' + i18n.t('headlines.emoji'), url: process.env.VITE_FRONTEND_URL }

  const template = fs.readFileSync('./mail/mail_template.ejs', { encoding: 'utf-8' })
  const renderedHTML = ejs.render(template, {
    salutation,
    paragaph,
    button,
    lastParagraph,
    regards,
    app
  })
  const plainText =
    salutation +
    '\n\n' +
    paragaph +
    '\n\n' +
    button.text +
    ': ' +
    button.link +
    '\n\n' +
    lastParagraph +
    '\n\n' +
    regards +
    '\n\n' +
    app.name +
    ': ' +
    app.url

  mailClient.sendMail({
    from: '"' + app.name + '" <' + process.env.MAIL_SENDER_ADDRESS + '>', // sender address
    to: recipients.map((r) => r.email), // list of receivers
    subject: subject, // Subject line
    text: plainText, // plain text body
    html: renderedHTML // html body
  })
}

export async function sendNotificationMail(travel: Travel) {
  const interpolation: { traveler: string; comment?: string; commentator?: string } = { traveler: travel.traveler.name }

  if (travel.comments.length > 0) {
    const comment = travel.comments[travel.comments.length - 1]
    if (comment.toState == travel.state) {
      interpolation.comment = comment.text
      interpolation.commentator = comment.author.name
    }
  }

  var recipients = []
  const subject = i18n.t('mail.' + travel.state + '.subject', interpolation)
  const paragraph = i18n.t('mail.' + travel.state + '.paragraph', interpolation)
  const button = {
    text: i18n.t('labels.viewX', { X: i18n.t('labels.travel') }),
    link: ''
  }
  const lastParagraph = interpolation.comment ? i18n.t('mail.' + travel.state + '.lastParagraph', interpolation) : ''

  if (travel.state === 'appliedFor') {
    recipients = await User.find({ 'access.approve': true }).lean()
    button.link = process.env.VITE_FRONTEND_URL + '/approve/' + travel._id
  } else if (travel.state === 'underExamination') {
    recipients = await User.find({ 'access.examine': true }).lean()
    button.link = process.env.VITE_FRONTEND_URL + '/examine/' + travel._id
  } else {
    // 'rejected', 'approved', 'refunded'
    recipients = [travel.traveler]
    button.link = process.env.VITE_FRONTEND_URL + '/travel' + (travel.state === 'rejected' ? '' : '/' + travel._id)
  }
  sendMail(recipients, subject, paragraph, button, lastParagraph)
}