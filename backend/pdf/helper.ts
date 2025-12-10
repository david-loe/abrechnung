import {
  Advance,
  ExpenseReport,
  HealthCareCost,
  Locale,
  reportIsAdvance,
  reportIsHealthCareCost,
  reportIsTravel,
  Travel
} from 'abrechnung-common/types.js'
import { getTotalBalance, sanitizeFilename } from 'abrechnung-common/utils/scripts.js'
import { Types } from 'mongoose'
import { BACKEND_CACHE } from '../db.js'
import { formatter, reportPrinter } from '../factory.js'
import i18n from '../i18n.js'
import Organisation from '../models/organisation.js'
import { getClient } from '../notifications/mail.js'

export async function writeToDiskFilePath(
  report: Travel<Types.ObjectId> | ExpenseReport<Types.ObjectId> | HealthCareCost<Types.ObjectId> | Advance<Types.ObjectId>
): Promise<string> {
  let path = '/reports/'
  let totalSum = ''
  formatter.setLocale(i18n.language as Locale)
  if (reportIsAdvance(report)) {
    path += 'advance/'
    totalSum = formatter.baseCurrency(report.budget.amount)
  } else {
    totalSum = formatter.baseCurrency(getTotalBalance(report.addUp))
    if (reportIsTravel(report)) {
      path += 'travel/'
    } else if (reportIsHealthCareCost(report)) {
      path += 'healthCareCost/'
    } else {
      path += 'expenseReport/'
    }
  }
  const org = await Organisation.findOne({ _id: report.project.organisation._id })
  const subfolder = org ? org.subfolderPath : ''
  const filename = sanitizeFilename(
    `${report.project.identifier} ${formatter.name(report.owner.name, 'shortWithoutPoint')} - ${report.name} ${totalSum}.pdf`
  )
  path += subfolder + filename
  return path
}

export async function sendViaMail(
  report: Travel<Types.ObjectId> | ExpenseReport<Types.ObjectId> | HealthCareCost<Types.ObjectId> | Advance<Types.ObjectId>
) {
  if (BACKEND_CACHE.connectionSettings.PDFReportsViaEmail.sendPDFReportsToOrganisationEmail) {
    const org = await Organisation.findOne({ _id: report.project.organisation._id })
    if (org?.reportEmail) {
      const mailClient = await getClient()
      const lng = BACKEND_CACHE.connectionSettings.PDFReportsViaEmail.locale
      formatter.setLocale(lng)
      let subject = '🧾 '
      const pdf = await reportPrinter.print(report, lng)
      let totalSum = ''
      if (reportIsAdvance(report)) {
        subject = subject + i18n.t('labels.advance', { lng })
        totalSum = formatter.baseCurrency(report.budget.amount)
      } else {
        totalSum = formatter.baseCurrency(getTotalBalance(report.addUp))
        if (reportIsTravel(report)) {
          subject = subject + i18n.t('labels.travel', { lng })
        } else if (reportIsHealthCareCost(report)) {
          subject = subject + i18n.t('labels.healthCareCost', { lng })
        } else {
          subject = subject + i18n.t('labels.expenseReport', { lng })
        }
      }

      const appName = `${i18n.t('headlines.title', { lng })} ${i18n.t('headlines.emoji', { lng })}`

      const text =
        `${i18n.t('labels.project', { lng })}: ${report.project.identifier}\n` +
        `${i18n.t('labels.name', { lng })}: ${report.name}\n` +
        `${i18n.t('labels.owner', { lng })}: ${formatter.name(report.owner.name)}\n` +
        `${i18n.t('labels.balance', { lng })}: ${totalSum}\n`

      return await mailClient.sendMail({
        from: `"${appName}" <${mailClient.options.from}>`, // sender address
        to: org?.reportEmail, // list of receivers
        subject: subject, // Subject line
        text,
        attachments: [{ content: Buffer.from(pdf), contentType: 'application/pdf', filename: 'report.pdf' }]
      })
    }
  }
}
