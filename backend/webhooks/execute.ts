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
import Webhook from '../models/webhook.js'
import { WebhookJobData, webhookQueue } from '../workers/webhook.js'
import { runUserScript } from './runScript.js'

export async function runWebhooks(
  report: Travel<Types.ObjectId> | ExpenseReport<Types.ObjectId> | HealthCareCost<Types.ObjectId> | Advance<Types.ObjectId>
) {
  const reportType = getReportTypeFromModelName(getModelNameFromReport(report))
  const hooks = await Webhook.find({ reportType, onState: report.state, isActive: true }).sort({ executionOrder: 1 }).lean()
  for (const hook of hooks) {
    await webhookQueue.add(`webhook:${hook.name}`, { input: report, webhook: hook }, { priority: hook.executionOrder })
  }
}

export async function processWebhookJob({ webhook, input }: WebhookJobData) {
  const request = { ...webhook.request, ...(webhook.script ? await runUserScript(webhook.script, input) : {}) }

  if (request.convertBodyToFormData && request.body) {
    const form = buildFormData(request.body)
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

function buildFormData(data: Record<string, any>): FormData {
  const form = new FormData()

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue

    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'number' || typeof item === 'string') {
          form.append(key, String(item))
        } else {
          throw new TypeError(`Listenelemente in '${key}' müssen number oder string sein: ${item}`)
        }
      }
    } else if (value instanceof Date) {
      form.append(key, value.toISOString())
    } else if (typeof value === 'object') {
      form.append(key, JSON.stringify(value))
    } else if (['number', 'boolean', 'string'].includes(typeof value)) {
      form.append(key, String(value))
    } else {
      throw new TypeError(`Nicht unterstützter Datentyp in Feld '${key}': ${typeof value}`)
    }
  }

  return form
}
