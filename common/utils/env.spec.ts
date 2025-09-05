declare const process: any
import test from 'ava'
import { cleanFrontendEnv, cleanBackendEnv } from './env.js'

test('cleanFrontendEnv validates and normalizes urls', (t) => {
  const env = cleanFrontendEnv({
    MODE: 'development',
    VITE_FRONTEND_URL: 'https://frontend.example.com/',
    VITE_BACKEND_URL: 'https://backend.example.com/'
  })
  t.is(env.VITE_FRONTEND_URL, 'https://frontend.example.com')
  t.is(env.VITE_BACKEND_URL, 'https://backend.example.com')
})

test('cleanBackendEnv parses numbers and booleans', (t) => {
  const env = cleanBackendEnv({
    MODE: 'development',
    VITE_FRONTEND_URL: 'https://frontend.example.com',
    VITE_BACKEND_URL: 'https://backend.example.com',
    NODE_ENV: 'development',
    COOKIE_SECRET: 'secret',
    MAGIC_LOGIN_SECRET: 'magic',
    MONGO_URL: 'mongodb://localhost:27017',
    BACKEND_PORT: '3000',
    TRUST_PROXY: 'true'
  })
  t.is(env.BACKEND_PORT, 3000)
  t.true(env.TRUST_PROXY)
})

test('cleanFrontendEnv throws on invalid url', (t) => {
  const oldExit = process.exit
  // @ts-ignore
  process.exit = () => { throw new Error('exit') }
  t.throws(() =>
    cleanFrontendEnv({
      MODE: 'development',
      VITE_FRONTEND_URL: 'ftp://example.com',
      VITE_BACKEND_URL: 'https://backend.example.com'
    })
  )
  process.exit = oldExit
})
