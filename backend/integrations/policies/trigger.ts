import { runPolicyAction } from '../runtime.js'

export async function retentionPolicy() {
  await runPolicyAction('retention.apply')
}
