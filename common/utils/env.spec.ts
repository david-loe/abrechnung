declare const process: { exit: unknown }

import test from 'ava'
import { ReporterOptions } from 'envalid'
import { cleanBackendEnv, cleanFrontendEnv } from './env.js'

const ENV = {
  VITE_FRONTEND_URL: 'https://frontend.example.com',
  VITE_BACKEND_URL: 'https://backend.example.com',
  MODE: 'development',
  VITE_PUBLIC_VAPID_KEY: 'publicKey',
  VITE_MAX_FILE_SIZE: '16000000',
  VITE_IMAGE_COMPRESSION_THRESHOLD_PX: '1400',
  NODE_ENV: 'development',
  COOKIE_SECRET: 'secret',
  MAGIC_LOGIN_SECRET: 'magic',
  MONGO_URL: 'mongodb://localhost:27017',
  REDIS_URL: 'redis://redis:6379',
  TRUST_PROXY: 'true'
}

// biome-ignore lint/suspicious/noExplicitAny: typing not nessary for test
const throwReporter = (errors: ReporterOptions<any>) => {
  if (!Object.keys(errors).length) return
  throw new Error()
}

test('cleanFrontendEnv validates and normalizes urls', (t) => {
  const env = cleanFrontendEnv(ENV)
  t.is(env.VITE_FRONTEND_URL, 'https://frontend.example.com')
  t.is(env.VITE_BACKEND_URL, 'https://backend.example.com')
  //@ts-expect-error
  t.throws(() => env.COOKIE_SECRET)
})

test('cleanBackendEnv parses numbers and booleans', (t) => {
  const env = cleanBackendEnv(ENV)
  t.is(env.VITE_MAX_FILE_SIZE, 16_000_000)
  t.true(env.TRUST_PROXY)
  t.is(env.WORKER_JOB_FAILED_TTL_SECONDS, false)
  t.is(env.WORKER_JOB_FAILED_MAX_COUNT, 100)
  t.is(env.WORKER_JOB_COMPLETED_TTL_SECONDS, 604_800)
  t.is(env.WORKER_JOB_COMPLETED_MAX_COUNT, 400)
})

test('cleanBackendEnv accepts explicit worker job retention limits and false', (t) => {
  const env = cleanBackendEnv({
    ...ENV,
    WORKER_JOB_FAILED_TTL_SECONDS: '3600',
    WORKER_JOB_FAILED_MAX_COUNT: 'false',
    WORKER_JOB_COMPLETED_TTL_SECONDS: 'false',
    WORKER_JOB_COMPLETED_MAX_COUNT: '25'
  })

  t.is(env.WORKER_JOB_FAILED_TTL_SECONDS, 3600)
  t.is(env.WORKER_JOB_FAILED_MAX_COUNT, false)
  t.is(env.WORKER_JOB_COMPLETED_TTL_SECONDS, false)
  t.is(env.WORKER_JOB_COMPLETED_MAX_COUNT, 25)
})

test('cleanBackendEnv rejects invalid worker job retention limits', (t) => {
  t.throws(() => cleanBackendEnv({ ...ENV, WORKER_JOB_FAILED_MAX_COUNT: '0' }, { reporter: throwReporter }))
  t.throws(() => cleanBackendEnv({ ...ENV, WORKER_JOB_COMPLETED_TTL_SECONDS: '1.5' }, { reporter: throwReporter }))
  t.throws(() => cleanBackendEnv({ ...ENV, WORKER_JOB_FAILED_TTL_SECONDS: 'null' }, { reporter: throwReporter }))
})

test('cleanFrontendEnv throws on invalid url', (t) => {
  t.throws(() =>
    cleanFrontendEnv(
      { MODE: 'development', VITE_FRONTEND_URL: 'example.com', VITE_BACKEND_URL: 'https://backend.example.com' },
      { reporter: throwReporter }
    )
  )
})
