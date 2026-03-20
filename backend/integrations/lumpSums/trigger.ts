import { runInboundSync } from '../runtime.js'

export async function fetchAndUpdateLumpSums() {
  await runInboundSync('lump_sums.sync_in')
}
