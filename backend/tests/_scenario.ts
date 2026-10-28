import type { ExecutionContext } from 'ava'

/** A workflow is one test; named steps retain their own assertions and stop on failure. */
export async function step(t: ExecutionContext, title: string, run: (t: ExecutionContext) => Promise<void> | void) {
  const attempt = await t.try(title, run)
  attempt.commit()
  if (!attempt.passed) throw new Error(`Workflow stopped at: ${title}`)
}
