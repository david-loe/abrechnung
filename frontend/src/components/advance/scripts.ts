import { AdvanceSimple, AdvanceState } from 'abrechnung-common/types.js'
import { Base64 } from 'abrechnung-common/utils/encoding.js'
import API from '@/api'

export async function getAdvances(ownerId: string | undefined, endpointPrefix: string) {
  const filter: Partial<Record<keyof AdvanceSimple, string | number | null | { $gte: number }>> = {
    state: { $gte: AdvanceState.APPROVED },
    settledOn: null
  }
  if (ownerId) filter.owner = ownerId
  const response = await API.getter<AdvanceSimple[]>(`${endpointPrefix}advance`, { filterJSON: Base64.encode(JSON.stringify(filter)) })
  const result = response.ok
  if (result) {
    return result.data
  }
  return []
}
