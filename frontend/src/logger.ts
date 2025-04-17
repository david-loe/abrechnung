import { LogLevel, Logger } from '../../common/logger.js'

export const logger = new Logger(import.meta.env.MODE === 'development' ? LogLevel.INFO : LogLevel.ERROR)
