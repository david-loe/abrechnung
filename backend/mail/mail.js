const mailClient = require('./client')
const i18n = require('../i18n')
const ejs = require('ejs')
const fs = require('fs')
const User = require('../models/user')

function sendMail(recipients, subject, paragaph, button, lastParagraph) {
  if (mailClient == undefined || recipients.length === 0) {
    return false
  }
  var salutation = i18n.t('mail.hi')
  if (recipients.length === 1) {
    salutation = i18n.t('mail.hiX', { X: recipients[0].name })
  }
  const regards = i18n.t('mail.regards')
  const app = { name: i18n.t("headlines.title") + ' ' + i18n.t("headlines.emoji"), url: process.env.VITE_FRONTEND_URL }

  const template = fs.readFileSync('./mail/mail_template.ejs', { encoding: 'utf-8' })
  const renderedHTML = ejs.render(template, {
    salutation, paragaph, button, lastParagraph, regards, app
  })
  const plainText = salutation + '\n\n' +
    paragaph + '\n\n' +
    button.text + ': ' + button.link + '\n\n' +
    lastParagraph + '\n\n' +
    regards + '\n\n' +
    app.name + ': ' + app.url

  mailClient.sendMail({
    from: '"' + app.name + '" <' + process.env.MAIL_SENDER_ADDRESS + '>', // sender address
    to: recipients.map((r) => r.email), // list of receivers
    subject: subject, // Subject line
    text: plainText, // plain text body
    html: renderedHTML, // html body
  })
}

async function sendNotificationMail(travel) {
  const interpolation = { traveler: travel.traveler.name }

  if (travel.comments.length > 0) {
    const comment = travel.comments[travel.comments.length - 1]
    if (comment.state == travel.state) {
      interpolation.comment = comment.text
      interpolation.commentator = comment.author
    }
  }

  var recipients = []
  const subject = i18n.t('mail.' + travel.state + '.subject', interpolation)
  const paragraph = i18n.t('mail.' + travel.state + '.paragraph', interpolation)
  const button = {
    text: i18n.t('labels.viewX', { X: i18n.t('labels.travel') })
  }
  const lastParagraph = interpolation.comment ? i18n.t('mail.' + travel.state + '.lastParagraph', interpolation) : ''

  if (travel.state === 'appliedFor') {
    recipients = await User.find({ 'access.approve': true })
    button.link = process.env.VITE_FRONTEND_URL + '/approve/' + travel._id

  } else if (travel.state === 'underExamination') {
    recipients = await User.find({ 'access.examine': true })
    button.link = process.env.VITE_FRONTEND_URL + '/examine/' + travel._id
  } else { // 'rejected', 'approved', 'refunded'
    recipients = [travel.traveler]
    button.link = process.env.VITE_FRONTEND_URL + '/travel' + (travel.state === 'rejected' ? '' : ('/' + travel._id))
  }
  sendMail(recipients, subject, paragraph, button, lastParagraph)
}

module.exports = { sendMail, sendNotificationMail }