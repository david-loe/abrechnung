import { type Integration } from './integration.js'
import { type IntegrationJobData } from './types.js'

export async function processIntegrationJob(job: IntegrationJobData, availableIntegrations?: Integration[]) {
  const resolvedIntegrations = availableIntegrations ?? (await import('./registry.js')).integrations
  const integration = resolvedIntegrations.find((entry) => entry.key === job.integrationKey)

  if (!integration) {
    throw new Error(`No integration found for key '${job.integrationKey}'.`)
  }

  await integration.execute(job.operation, job.payload)
}
