import { emitIntegrationEvent as emitIntegrationEventWithIntegrations, type IntegrationEvent } from './events.js'
import { integrations } from './registry.js'

export async function emitIntegrationEvent(event: IntegrationEvent) {
  await emitIntegrationEventWithIntegrations(event, integrations)
}
