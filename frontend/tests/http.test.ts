import axios from 'axios'
import { describe, expect, it } from 'vitest'
import { requestBody, serve } from './http.js'

describe('multipart HTTP fixture', () => {
  it('decodes nested text fields from buffered multipart requests', async () => {
    const fields = { report: { name: 'Travel; filename=example', note: 'Keep\nthis note' } }
    serve((request) => ({ data: requestBody(request) }))

    const response = await axios.post('http://backend.test/report', axios.toFormData(fields))

    expect(response.data).toEqual(fields)
  })

  it('rejects buffered file parts instead of silently dropping them', async () => {
    const form = axios.toFormData({ description: 'Receipt' })
    form.append('receipt', Buffer.from('binary data'), { filename: 'receipt.pdf', contentType: 'application/pdf' })
    serve((request) => ({ data: requestBody(request) }))

    await expect(axios.post('http://backend.test/report', form)).rejects.toThrow('Binary multipart uploads require a real HTTP fixture')
  })
})
