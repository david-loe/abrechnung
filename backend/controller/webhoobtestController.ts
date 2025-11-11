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
    // Logobjekt bauen
    const logEntry = {
      remoteAddr: req.ip,
      method: req.method,
      httpVersion: `${req.httpVersionMajor ?? 1}.${req.httpVersionMinor ?? 1}`,
      url: req.originalUrl,
      headers: req.headers,
      query: req.query,
      params: req.params,
      body: req.body
    }

    console.log(logEntry)

    // Echo-Antwort zum schnellen Testen
    return {
      ok: true,
      // nur Metadaten zurückgeben, keine sensiblen Header spiegeln
      meta: { method: req.method, path: req.path, contentType: req.headers['content-type'] || null }
    }
  }
}
