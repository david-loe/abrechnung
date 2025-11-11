import { startFileSystemWorker } from './fileSystem.js'
import { startMailWorker } from './mail.js'
import { startWebhookWorker } from './webhook.js'

startFileSystemWorker()
startMailWorker()
startWebhookWorker()
