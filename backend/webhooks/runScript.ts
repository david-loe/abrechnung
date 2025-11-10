import { Webhook, WebhookMethod, webhookMethods } from 'abrechnung-common/types.js'
import ivm from 'isolated-vm'
import ENV from '../env.js'

export async function runUserScript(userScriptCode: string, input: unknown) {
  const isolate = new ivm.Isolate({ memoryLimit: ENV.WEBHOOK_SCRIPT_MEMORY_LIMIT_MB })
  const context = await isolate.createContext()
  const jail = context.global
  await jail.set('global', jail.derefInto())

  // sanitize input
  const wrapped = `
    Object.defineProperty(global, 'process', { value: undefined });
    Object.defineProperty(global, 'require', { value: undefined });
    Object.defineProperty(global, 'Buffer',  { value: undefined });
    ${userScriptCode}
    if (typeof run !== 'function') { throw new Error('Script must define a function called \\'run\\''); }
    global.__run = run;
  `
  // compile
  const script = await isolate.compileScript(wrapped)
  await script.run(context, { timeout: ENV.WEBHOOK_SCRIPT_COMPILE_TIMEOUT_MS })

  // run
  const result = await context.global
    .get('__run', { reference: true })
    .then((ref) =>
      ref.apply(undefined, [input], { timeout: ENV.WEBHOOK_SCRIPT_RUN_TIMEOUT_MS, arguments: { copy: true }, result: { copy: true } })
    )

  return validateWebhookResultPartial(result)
}

export function validateWebhookResultPartial(obj: unknown): Partial<Webhook['request']> {
  if (typeof obj !== 'object' || obj === null) {
    throw new Error('Result must be an object')
  }

  const anyObj = obj as Record<string, unknown>
  const { url, headers, method, pdfFormFieldName, body } = anyObj

  if (url !== undefined) {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      throw new Error('If present, "url" must be a valid URL string')
    }
  }

  if (headers !== undefined) {
    if (typeof headers !== 'object' || headers === null) {
      throw new Error('"headers" must be an object if present')
    }
    for (const [k, v] of Object.entries(headers)) {
      if (typeof k !== 'string' || typeof v !== 'string') {
        throw new Error('All header keys and values must be strings')
      }
    }
  }

  if (method !== undefined) {
    if (typeof method !== 'string' || !webhookMethods.includes(method as WebhookMethod)) {
      throw new Error(`"method" must be one of ${webhookMethods.join(', ')}`)
    }
  }

  if (pdfFormFieldName !== undefined) {
    if (typeof pdfFormFieldName !== 'string') {
      throw new Error('"pdfFormFieldName" must be a string if present')
    }
  }

  return {
    ...(url !== undefined ? { url: url as string } : {}),
    ...(headers !== undefined ? { headers: headers as Record<string, string> } : {}),
    ...(method !== undefined ? { method: method as WebhookMethod } : {}),
    ...(pdfFormFieldName !== undefined ? { pdfFormFieldName } : {}),
    ...(body !== undefined ? { body } : {})
  }
}
