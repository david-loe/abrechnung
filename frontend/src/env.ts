/// <reference types="vite/client" />
import { cleanFrontendEnv } from 'abrechnung-common/utils/env'

const ENV = cleanFrontendEnv(import.meta.env)

export default ENV
