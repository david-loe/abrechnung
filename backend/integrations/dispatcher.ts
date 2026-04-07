import {
  emitIntegrationEvent as emitIntegrationEventWithIntegrations,
  type IntegrationEvent,
  type IntegrationEventByType
} from './events.js'
import { integrations } from './registry.js'

export async function emitIntegrationEvent<TType extends IntegrationEvent['type']>(event: IntegrationEventByType<TType>) {
  await emitIntegrationEventWithIntegrations(event, integrations)
}
