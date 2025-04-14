import { addUp, sanitizeFilename } from '../../common/scripts.js'
import { ExpenseReport, HealthCareCost, Locale, Travel, reportIsHealthCareCost, reportIsTravel } from '../../common/types.js'
import { getConnectionSettings } from '../db.js'
import { reportPrinter } from '../factory.js'
import i18n, { formatter } from '../i18n.js'
import Organisation from '../models/organisation.js'
import { getClient } from '../notifications/mail.js'

export async function writeToDiskFilePath(report: Travel | ExpenseReport | HealthCareCost): Promise<string> {
  let path = '/reports/'
  if (reportIsTravel(report)) {
    if (report.state === 'approved') {
      path += 'advance/'
    } else {
      path += 'travel/'
    }
  } else if (reportIsHealthCareCost(report)) {
    if (report.state === 'refunded') {
      path += 'healthCareCost/confirmed/'
    } else {
      path += 'healthCareCost/'
    }
  } else {
    path += 'expenseReport/'
  }
  formatter.setLocale(i18n.language as Locale)
  const totalSum = formatter.money(addUp(report).balance)
  const org = await Organisation.findOne({ _id: report.project.organisation._id })
  const subfolder = org ? org.subfolderPath : ''
  const filename = sanitizeFilename(
    report.owner.name.familyName + ' ' + report.owner.name.givenName.substring(0, 1) + ' - ' + report.name + ' ' + totalSum + '.pdf'
  )
  path += subfolder + filename
  return path
}

export async function sendViaMail(report: Travel | ExpenseReport | HealthCareCost) {
  const connectionSettings = await getConnectionSettings()
  if (connectionSettings.PDFReportsViaEmail.sendPDFReportsToOrganisationEmail) {
    const org = await Organisation.findOne({ _id: report.project.organisation._id })
    if (org?.reportEmail) {
      const mailClient = await getClient()
      const lng = connectionSettings.PDFReportsViaEmail.locale
      let subject = '🧾 '
      let pdf: Uint8Array
      if (reportIsTravel(report)) {
        if (report.state == 'refunded') {
          subject = subject + i18n.t('labels.travel', { lng })
          pdf = await reportPrinter.print(report, lng)
        } else {
          subject = subject + i18n.t('labels.advance', { lng })
          pdf = await reportPrinter.print(report, lng)
        }
      } else if (reportIsHealthCareCost(report)) {
        subject = subject + i18n.t('labels.healthCareCost', { lng })
        pdf = await reportPrinter.print(report, lng)
      } else {
        subject = subject + i18n.t('labels.expenseReport', { lng })
        pdf = await reportPrinter.print(report, lng)
      }
      const appName = i18n.t('headlines.title', { lng }) + ' ' + i18n.t('headlines.emoji', { lng })
      formatter.setLocale(lng)
      const totalSum = formatter.money(addUp(report).balance)

      const text =
        `${i18n.t('labels.project', { lng })}: ${report.project.identifier}\n` +
        `${i18n.t('labels.name', { lng })}: ${report.name}\n` +
        `${i18n.t('labels.owner', { lng })}: ${report.owner.name.givenName} ${report.owner.name.familyName}\n` +
        `${i18n.t('labels.balance', { lng })}: ${totalSum}\n`

      return await mailClient.sendMail({
        from: '"' + appName + '" <' + mailClient.options.from + '>', // sender address
        to: org?.reportEmail, // list of receivers
        subject: subject, // Subject line
        text,
        attachments: [
          {
            content: Buffer.from(pdf),
            contentType: 'application/pdf',
            filename: 'report.pdf'
          }
        ]
      })
    }
  }
}
