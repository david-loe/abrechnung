import fs from 'node:fs/promises'
import path from 'node:path'
import { Advance, ExpenseReport, HealthCareCost, Travel } from 'abrechnung-common/types.js'
import { getConnectionSettings, getDisplaySettings, getPrinterSettings, getTravelSettings } from '../../db.js'
import ENV from '../../env.js'
import { logger } from '../../logger.js'
import { writeToDiskFilePath } from '../../pdf/helper.js'
import { renderReportPdf } from '../../pdf/report.js'
import { type IntegrationEventHandlerMap } from '../events.js'
import { Integration } from '../integration.js'

interface ReportWriteDiskPayload {
  filePath: string
  report: Travel | ExpenseReport | HealthCareCost | Advance
}

class ReportDiskIntegration extends Integration {
  override readonly events: Partial<IntegrationEventHandlerMap> = {
    'report.review_completed': async ({ report }) => {
      const diskReport = report as ReportWriteDiskPayload['report']
      await this.enqueue('write', { filePath: await writeToDiskFilePath(diskReport), report: diskReport })
    }
  }

  public override readonly operations = {
    write: {
      jobOptions: { attempts: 6, backoff: { type: 'exponential', delay: 3_000 } },
      run: async (payload: unknown) => {
        await saveReportOnDisk(payload as ReportWriteDiskPayload)
      }
    }
  }

  public constructor() {
    super('reports.disk')
  }
}

export const reportDiskIntegration = new ReportDiskIntegration()

export async function saveReportOnDisk({ filePath, report }: ReportWriteDiskPayload) {
  if (!ENV.BACKEND_SAVE_REPORTS_ON_DISK) {
    logger.debug('Report disk delivery disabled, skipping integration job.')
    return
  }

  const connectionSettings = await getConnectionSettings(false)
  const lng = connectionSettings.PDFReportsViaEmail.locale

  const displaySettings = await getDisplaySettings(false)
  const printerSettings = await getPrinterSettings(false)
  const travelSettings = await getTravelSettings(false)
  const pdf = await renderReportPdf(report, lng, { displaySettings, printerSettings, travelSettings })

  await fs.mkdir(path.dirname(filePath), { recursive: true })
  logger.debug(`Write to file ${filePath}`)
  await fs.writeFile(filePath, pdf)
}
