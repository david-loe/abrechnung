import test from 'ava'
import { runUserScript } from '../../integrations/webhooks/runScript.js'

test('webhook scripts copy input and output across the isolate', async (t) => {
  const input = { reportId: 'report-1', state: 10 }
  const result = await runUserScript(
    `function run(report) {
      report.state = 20
      return { method: 'POST', body: report }
    }`,
    input
  )

  t.deepEqual(result, { method: 'POST', body: { reportId: 'report-1', state: 20 } })
  t.deepEqual(input, { reportId: 'report-1', state: 10 })
})

test('webhook scripts cannot access Node globals', async (t) => {
  const result = await runUserScript(
    `function run() {
      return { body: [typeof process, typeof require, typeof Buffer] }
    }`,
    {}
  )

  t.deepEqual(result, { body: ['undefined', 'undefined', 'undefined'] })
})

test('webhook scripts stop when they exceed the execution timeout', async (t) => {
  await t.throwsAsync(runUserScript('function run() { while (true) {} }', {}), { message: /timed out/i })
})
