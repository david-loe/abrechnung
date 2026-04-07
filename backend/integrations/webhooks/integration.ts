import {
  _id,
  Advance,
  ExpenseReport,
  getModelNameFromReport,
  getReportTypeFromModelName,
  HealthCareCost,
  Webhook as IWebhook,
  State,
  Travel
} from 'abrechnung-common/types.js'
import { refNumberToString } from 'abrechnung-common/utils/scripts.js'
import axios from 'axios'
import { getConnectionSettings, getDisplaySettings, getPrinterSettings, getTravelSettings } from '../../db.js'
import ENV from '../../env.js'
import { reportPrinter } from '../../factory.js'
import { updateI18n } from '../../i18n.js'
import Webhook from '../../models/webhook.js'
import { type IntegrationEventHandlerMap } from '../events.js'
import { Integration } from '../integration.js'
import { runUserScript } from './runScript.js'

type WebhookJobInput = Travel | ExpenseReport | HealthCareCost | Advance

interface WebhookJobData {
  input: WebhookJobInput
  webhook: IWebhook
}

class WebhookIntegration extends Integration {
  override readonly events: Partial<IntegrationEventHandlerMap> = {
    'report.draft_saved': async ({ report }) => await this.enqueueMatchingWebhooks(report),
    'report.submitted': async ({ report }) => await this.enqueueMatchingWebhooks(report),
    'report.review_requested': async ({ report }) => await this.enqueueMatchingWebhooks(report),
    'report.rejected': async ({ report }) => await this.enqueueMatchingWebhooks(report),
    'report.back_to_in_work': async ({ report }) => await this.enqueueMatchingWebhooks(report),
    'report.review_completed': async ({ report }) => await this.enqueueMatchingWebhooks(report),
    'travel.directly_approved': async ({ report }) => await this.enqueueMatchingWebhooks(report),
    'travel.approved': async ({ report }) => await this.enqueueMatchingWebhooks(report),
    'advance.received': async ({ report }) => await this.enqueueMatchingWebhooks(report)
  }

  public override readonly operations = {
    deliver: {
      jobOptions: { attempts: ENV.WEBHOOK_ATTEMPTS, backoff: { type: 'exponential', delay: ENV.WEBHOOK_RETRY_DELAY } },
      run: async ({ input, webhook }: WebhookJobData) => {
        await processWebhookJob({ input, webhook })
      }
    }
  }

  public constructor() {
    super('webhooks')
  }

  private async enqueueMatchingWebhooks(report: WebhookJobInput) {
    const webhooks = await findMatchingWebhooks(report)
    for (const webhook of webhooks) {
      await this.enqueue('deliver', { input: report, webhook })
    }
  }
}

export const webhookIntegration = new WebhookIntegration()

async function findMatchingWebhooks(report: WebhookJobInput) {
  const reportType = getReportTypeFromModelName(getModelNameFromReport(report))
  return await Webhook.find({ reportType, onState: report.state, isActive: true }).sort({ executionOrder: 1 }).lean()
}

export async function processWebhookJob({ webhook, input }: WebhookJobData) {
  const request = { ...webhook.request, ...(webhook.script ? await runUserScript(webhook.script, input) : {}) }

  if (request.convertBodyToFormData) {
    const form = buildFormData(request.body && typeof request.body === 'object' ? request.body : {})
    if (request.pdfFormFieldName && input.state >= State.BOOKABLE) {
      const connectionSettings = await getConnectionSettings(false)
      const lng = connectionSettings.PDFReportsViaEmail.locale

      const displaySettings = await getDisplaySettings(false)
      updateI18n(displaySettings.locale)

      const printerSettings = await getPrinterSettings(false)
      const travelSettings = await getTravelSettings(false)
      reportPrinter.setSettings(printerSettings)
      reportPrinter.setTravelSettings(travelSettings)
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

function buildFormData(data: object) {
  const form = new FormData()

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue

    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'number' || typeof item === 'string') {
          form.append(key, String(item))
        } else {
          throw new TypeError(`List elements in '${key}' have to be number or string: ${item}`)
        }
      }
    } else if (value instanceof Date) {
      form.append(key, value.toISOString())
    } else if (typeof value === 'object') {
      form.append(key, JSON.stringify(value))
    } else if (['number', 'boolean', 'string'].includes(typeof value)) {
      form.append(key, String(value))
    } else {
      throw new TypeError(`Not supported type in '${key}': ${typeof value}`)
    }
  }

  return form
}
