import { startMailWorker } from './mail.js'
import { startSaveReportOnDiskWorker } from './saveReportOnDisk.js'
import { startWebhookWorker } from './webhook.js'

startSaveReportOnDiskWorker()
startMailWorker()
startWebhookWorker()
