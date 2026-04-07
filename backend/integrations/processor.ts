import { type Integration } from './integration.js'
import { type IntegrationJobData } from './queue.js'
import { integrations } from './registry.js'

export async function processIntegrationJob(job: IntegrationJobData, availableIntegrations?: Integration[]) {
  const resolvedIntegrations = availableIntegrations ?? integrations
  const integration = resolvedIntegrations.find((entry) => entry.key === job.integrationKey)

  if (!integration) {
    throw new Error(`No integration found for key '${job.integrationKey}'.`)
  }

  await integration.runOperation(job.operation, job.payload)
}
