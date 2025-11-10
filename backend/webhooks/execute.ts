import { Webhook } from 'abrechnung-common/types.js'
import axios from 'axios'
import ENV from '../env.js'

export async function executeWebhook(hook: Webhook) {
  const res = await axios.request({
    url: hook.request.url,
    method: hook.request.method,
    headers: hook.request.headers,
    data: hook.request.body,
    timeout: ENV.WEBHOOK_REQUEST_TIMEOUT_MS
  })

  return {
    status: res.status,
    ok: res.status >= 200 && res.status < 300,
    headers: res.headers,
    url: (res.request?.res?.responseUrl ?? hook.request.url) as string,
    body: res.data
  }
}
