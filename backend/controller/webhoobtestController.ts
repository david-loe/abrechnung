import { Request as ExRequest } from 'express'
import { Body, Post, Request, Route, Tags } from 'tsoa'
import { runUserScript } from '../webhooks/runScript.js'

@Tags('Awebhook')
@Route('webhook')
export class WEbhookController {
  @Post('script')
  public async get(@Body() requestBody: { script: string }) {
    await runUserScript(requestBody.script, { test: 123, foo: 'bar' })
  }
  @Post('test')
  public async post(@Request() req: ExRequest) {
    const rawBody: Buffer = Buffer.isBuffer(req.body) ? (req.body as Buffer) : Buffer.from('')

    const bodyText = rawBody.toString('utf8')
    const bodyJson = tryParseJSON(rawBody)

    // Logobjekt bauen
    const logEntry = {
      remoteAddr: req.ip,
      method: req.method,
      httpVersion: `${req.httpVersionMajor ?? 1}.${req.httpVersionMinor ?? 1}`,
      url: req.originalUrl,
      headers: req.headers,
      query: req.query,
      params: req.params,
      body: {
        length: rawBody.length,
        asTextPreview: bodyText.length > 2000 ? `${bodyText.slice(0, 2000)}…[truncated]` : bodyText,
        asJSON: bodyJson // undefined, wenn kein gültiges JSON
      }
    }

    console.log(logEntry)

    // Echo-Antwort zum schnellen Testen
    return {
      ok: true,
      // nur Metadaten zurückgeben, keine sensiblen Header spiegeln
      meta: {
        method: req.method,
        path: req.path,
        contentType: req.headers['content-type'] || null,
        bodyLength: rawBody.length,
        parsedJSON: bodyJson !== undefined
      }
    }
  }
}
function tryParseJSON(buf: Buffer) {
  try {
    return JSON.parse(buf.toString('utf8'))
  } catch {
    return undefined
  }
}
