import { bool, CleanOptions, cleanEnv, EnvError, json, makeValidator, str } from 'envalid'
import { ConnectionSettings } from '../types.js'

const int = makeValidator<number>((input: string) => {
  const coerced = Number.parseInt(input, 10)
  if (Number.isNaN(coerced)) throw new EnvError(`Invalid integer input: "${input}"`)
  return coerced
})

const url = makeValidator<string>((input: string) => {
  try {
    const parsed = new URL(input)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Invalid protocol: "${parsed.protocol}". Only "http:" and "https:" are allowed.`)
    }
    if (input.endsWith('/') && !parsed.search && !parsed.hash) {
      input = input.slice(0, -1)
    }
    return input
  } catch (e) {
    throw new EnvError(`Invalid URL input: "${input}" - ${e}`)
  }
})

const trustProxy = makeValidator<string | boolean | number>((input: string) => {
  if (input.toLowerCase() === 'true') {
    return true
  } else if (input.match(/^\d+$/)) {
    return Number.parseInt(input, 10)
  } else {
    return input
  }
})

const notEmptyString = makeValidator<string>((input: string) => {
  if (input.trim() === '') {
    throw new EnvError(`Empty string input not allowed.`)
  }
  return input
})

const baseEnvConfig = {
  VITE_FRONTEND_URL: url({ desc: 'URL to reach the frontend (without trailing slash)' }),
  VITE_BACKEND_URL: url({ desc: 'URL to reach the backend (without trailing slash)' }),
  VITE_PUBLIC_VAPID_KEY: notEmptyString({ default: undefined, desc: 'Public VAPID Key for WebPush Notifications' }),
  VITE_MAX_FILE_SIZE: int({ default: 16_000_000, desc: 'Maximal size allowed of files being uploaded in bytes' }),
  VITE_IMAGE_COMPRESSION_THRESHOLD_PX: int({
    default: 1_400,
    desc: 'Longest side of an image in pixels before client side compression is applied'
  })
}
const frontendEnvConfig = Object.assign({ MODE: str({ choices: ['development', 'production'] }) }, baseEnvConfig)

const backendEnvConfig = Object.assign({}, baseEnvConfig, {
  NODE_ENV: str({ choices: ['development', 'production'] }),
  COOKIE_SECRET: notEmptyString({ desc: "Cookie Secret (use something like: 'openssl rand -base64 30')" }),
  MAGIC_LOGIN_SECRET: notEmptyString({ desc: "Secret for magic login links (use something like: 'openssl rand -base64 60')" }),
  MONGO_URL: notEmptyString({ desc: 'MongoDB connection string' }),
  REDIS_URL: notEmptyString({ desc: 'Redis URL' }),

  COOKIE_MAX_AGE_DAYS: int({ default: 30 }),
  PRIVATE_VAPID_KEY: notEmptyString({ default: undefined, desc: 'Private VAPID Key for WebPush Notifications' }),
  LOG_LEVEL: notEmptyString({ default: 'INFO', choices: ['DEBUG', 'INFO', 'WARN', 'ERROR'], desc: 'Log Level for the backend' }),
  TZ: notEmptyString({
    default: 'Etc/UTC',
    desc: 'Timezone - find yours here: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones'
  }),
  TRUST_PROXY: trustProxy({ default: false }),
  RATE_LIMIT_WINDOW_MS: int({ default: undefined, desc: 'How long to remember requests for, in milliseconds (empty for no limit)' }),
  RATE_LIMIT: int({ default: undefined, desc: 'How many requests to allow (empty for no limit)' }),
  WEBHOOK_SCRIPT_MEMORY_LIMIT_MB: int({ default: 16, desc: 'Memory limit for user webhook scripts in MB' }),
  WEBHOOK_SCRIPT_COMPILE_TIMEOUT_MS: int({ default: 50, desc: 'Timeout for compiling user webhook scripts in milliseconds' }),
  WEBHOOK_SCRIPT_RUN_TIMEOUT_MS: int({ default: 100, desc: 'Timeout for running user webhook scripts in milliseconds' }),
  WEBHOOK_REQUEST_TIMEOUT_MS: int({ default: 5_000, desc: 'Timeout webhook HTTP requests in milliseconds' }),
  PROD_INIT_CONNECTION_SETTINGS: json<Partial<ConnectionSettings>>({
    default: undefined,
    desc: 'Initial connection settings for production environment as JSON object'
  }),
  USAGE_API_TOKEN: notEmptyString({ default: undefined, desc: 'Token to authenticate against the usage endpoints.' }),
  BACKEND_SAVE_REPORTS_ON_DISK: bool({
    default: false,
    desc: "⚠️Deprecated⚠️ If set to 'TRUE', all reports will be saved to `/reports` in the backend container. Uncomment the corresponding backend volume in `docker-compose.yml` to get reports on host machine"
  })
})

export function cleanFrontendEnv(env: Record<string, unknown>, options?: CleanOptions<typeof frontendEnvConfig>) {
  return cleanEnv(env, frontendEnvConfig, options)
}

export function cleanBackendEnv(env: Record<string, unknown>, options?: CleanOptions<typeof backendEnvConfig>) {
  return cleanEnv(env, backendEnvConfig, options)
}
