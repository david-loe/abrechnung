import {
  Advance,
  ExpenseReport,
  HealthCareCost,
  reportIsAdvance,
  reportIsHealthCareCost,
  reportIsTravel,
  Travel
} from 'abrechnung-common/types.js'
import { getTotalBalance } from 'abrechnung-common/utils/scripts.js'
import { Types } from 'mongoose'
import { getConnectionSettings, getDisplaySettings, getPrinterSettings, getTravelSettings } from '../../db.js'
import { createFormatter } from '../../factory.js'
import i18n from '../../i18n.js'
import Organisation from '../../models/organisation.js'
import { renderReportPdf } from '../../pdf/report.js'
import { type IntegrationEventHandlerMap } from '../events.js'
import { Integration } from '../integration.js'
import { getMailClient } from '../notifications/email.js'

interface ReportEmailPayload {
  report: Travel<Types.ObjectId> | ExpenseReport<Types.ObjectId> | HealthCareCost<Types.ObjectId> | Advance<Types.ObjectId>
}

class ReportMailIntegration extends Integration {
  override readonly events: Partial<IntegrationEventHandlerMap> = {
    'report.review_completed': async ({ report }) => {
      await this.enqueue('send', { report })
    }
  }

  public override readonly operations = {
    send: {
      jobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 5_000 } },
      run: async (payload: unknown) => {
        await sendReportViaMail((payload as ReportEmailPayload).report)
      }
    }
  }

  public constructor() {
    super('reports.email')
  }
}

export const reportMailIntegration = new ReportMailIntegration()

export async function sendReportViaMail(
  report: Travel<Types.ObjectId> | ExpenseReport<Types.ObjectId> | HealthCareCost<Types.ObjectId> | Advance<Types.ObjectId>
) {
  const connectionSettings = await getConnectionSettings(false)
  if (connectionSettings.PDFReportsViaEmail.sendPDFReportsToOrganisationEmail) {
    const org = await Organisation.findOne({ _id: report.project.organisation._id })
    if (org?.reportEmail) {
      const mailClient = await getMailClient()
      const lng = connectionSettings.PDFReportsViaEmail.locale
      const displaySettings = await getDisplaySettings(false)
      const printerSettings = await getPrinterSettings(false)
      const travelSettings = await getTravelSettings(false)
      const formatter = createFormatter(lng, displaySettings.nameDisplayFormat)
      let subject = '🧾 '
      const pdf = await renderReportPdf(report, lng, { displaySettings, printerSettings, travelSettings })
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
        `${i18n.t('labels.label', { lng })}: ${report.name}\n` +
        `${i18n.t('labels.owner', { lng })}: ${formatter.name(report.owner.name)}\n` +
        `${i18n.t('labels.balance', { lng })}: ${totalSum}\n`

      return await mailClient.sendMail({
        from: `"${appName}" <${mailClient.options.from}>`,
        to: org.reportEmail,
        subject,
        text,
        attachments: [{ content: Buffer.from(pdf), contentType: 'application/pdf', filename: 'report.pdf' }]
      })
    }
  }
}
