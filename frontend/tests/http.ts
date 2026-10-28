import axios, { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import qs from 'qs'
import { afterEach } from 'vitest'

interface Reply {
  data: unknown
  status?: number
}
const originalAdapter = axios.defaults.adapter

afterEach(() => {
  axios.defaults.adapter = originalAdapter
})

/** A server boundary for Node tests: Axios serialization, API and session code stay real. */
export function serve(handler: (request: InternalAxiosRequestConfig) => Reply | Promise<Reply>) {
  axios.defaults.adapter = async (config) => {
    const reply = await handler(config)
    const response = { config, data: reply.data, status: reply.status ?? 200, statusText: '', headers: new AxiosHeaders() }
    if (response.status >= 400) throw new AxiosError(`HTTP ${response.status}`, 'ERR_BAD_RESPONSE', config, undefined, response)
    return response
  }
}

export function requestBody(config: InternalAxiosRequestConfig) {
  if (typeof config.data === 'string') return JSON.parse(config.data)
  if (typeof config.data?.getBuffer === 'function') {
    const multipart = config.data.getBuffer().toString() as string
    const fields: Record<string, string> = {}
    for (const part of multipart.split(`--${config.data.getBoundary()}`)) {
      const match = part.match(/name="([^"]+)"\r\n\r\n([\s\S]*?)\r\n$/)
      if (match) fields[match[1]] = match[2]
    }
    return qs.parse(fields, { depth: 20 })
  }
  if (config.data instanceof FormData) {
    const fields: Record<string, string> = {}
    for (const [key, value] of config.data.entries()) {
      if (typeof value !== 'string') throw new Error('Binary multipart uploads require a real HTTP fixture')
      fields[key] = value
    }
    return qs.parse(fields, { depth: 20 })
  }
  return config.data
}
