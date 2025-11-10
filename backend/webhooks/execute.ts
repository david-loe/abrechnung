import { getModelNameFromReport } from 'abrechnung-common/types.js'
import { refNumberToString } from 'abrechnung-common/utils/scripts.js'
import axios from 'axios'
import { getConnectionSettings } from '../db.js'
import ENV from '../env.js'
import { reportPrinter } from '../factory.js'
import { WebhookJobData } from '../workers/webhook.js'
import { runUserScript } from './runScript.js'

export async function processWebhookJob({ webhook, input }: WebhookJobData) {
  const request = { ...webhook.request, ...(webhook.script ? await runUserScript(webhook.script, input) : {}) }

  if (request.pdfFormFieldName && request.body instanceof FormData) {
    const connectionSettings = await getConnectionSettings()
    const lng = connectionSettings.PDFReportsViaEmail.locale
    request.body.append(
      request.pdfFormFieldName,
      new Blob([await reportPrinter.print(input, lng)], { type: 'application/pdf' }),
      `${refNumberToString(input.reference, getModelNameFromReport(input))}.pdf`
    )
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
