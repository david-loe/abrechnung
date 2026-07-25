/// <reference types="vite/client" />
import { cleanFrontendEnv } from 'abrechnung-common/utils/env.js'

declare global {
  var __ABRECHNUNG_ENV__: Record<string, unknown> | undefined
}

const ENV = cleanFrontendEnv(globalThis.__ABRECHNUNG_ENV__ ?? import.meta.env)

export default ENV
