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
})

test('cleanFrontendEnv throws on invalid url', (t) => {
  t.throws(() =>
    cleanFrontendEnv(
      { MODE: 'development', VITE_FRONTEND_URL: 'example.com', VITE_BACKEND_URL: 'https://backend.example.com' },
      { reporter: throwReporter }
    )
  )
})
