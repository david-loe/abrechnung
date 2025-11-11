import {
  Advance,
  ExpenseReport,
  getModelNameFromReport,
  getReportTypeFromModelName,
  HealthCareCost,
  State,
  Travel
} from 'abrechnung-common/types.js'
import { refNumberToString } from 'abrechnung-common/utils/scripts.js'
import axios from 'axios'
import { Types } from 'mongoose'
import { getConnectionSettings } from '../db.js'
import ENV from '../env.js'
import { reportPrinter } from '../factory.js'
import { objectToFormFields } from '../helper.js'
import Webhook from '../models/webhook.js'
import { WebhookJobData, webhookQueue } from '../workers/webhook.js'
import { runUserScript } from './runScript.js'

export async function runWebhooks(
  report: Travel<Types.ObjectId> | ExpenseReport<Types.ObjectId> | HealthCareCost<Types.ObjectId> | Advance<Types.ObjectId>
) {
  const reportType = getReportTypeFromModelName(getModelNameFromReport(report))
  const hooks = await Webhook.find({ reportType, onState: report.state }).sort({ executionOrder: 1 }).lean()
  for (const hook of hooks) {
    await webhookQueue.add(`webhook:${hook.name}`, { input: report, webhook: hook }, { priority: hook.executionOrder })
  }
}

export async function processWebhookJob({ webhook, input }: WebhookJobData) {
  const request = { ...webhook.request, ...(webhook.script ? await runUserScript(webhook.script, input) : {}) }

  if (request.convertBodyToFormData && request.body) {
    const form = new FormData()
    const fields = objectToFormFields(request.body)
    fields.forEach(({ field, val }) => {
      form.append(field, val.toString())
    })
    if (request.pdfFormFieldName && input.state >= State.BOOKABLE) {
      const connectionSettings = await getConnectionSettings()
      const lng = connectionSettings.PDFReportsViaEmail.locale
      form.append(
        request.pdfFormFieldName,
        new Blob([await reportPrinter.print(input, lng)], { type: 'application/pdf' }),
        `${refNumberToString(input.reference, getModelNameFromReport(input))}.pdf`
      )
    }
    request.body = form
  }

  const res = await axios.request({
    url: request.url,
    method: request.method,
    headers: request.headers,
    data: request.body,
    timeout: ENV.WEBHOOK_REQUEST_TIMEOUT_MS
  })

  return {
    status: res.status,
    ok: res.status >= 200 && res.status < 300,
    headers: res.headers,
    url: (res.request?.res?.responseUrl ?? request.url) as string,
    body: res.data
  }
}
