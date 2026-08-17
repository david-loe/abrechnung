import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useUnsavedChangesGuard } from '@/useUnsavedChangesGuard.js'

describe('unsaved changes guard', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('only asks for confirmation when the form differs from its initial value', () => {
    const confirm = vi.fn(() => false)
    vi.stubGlobal('confirm', confirm)
    const formValue = ref({ description: 'Train', cost: { amount: 12 } })
    const guard = useUnsavedChangesGuard(formValue)

    expect(guard.confirmNavigation('Discard changes?')).toBe(true)
    expect(confirm).not.toHaveBeenCalled()

    formValue.value.description = 'Taxi'

    expect(guard.confirmNavigation('Discard changes?')).toBe(false)
    expect(confirm).toHaveBeenCalledWith('Discard changes?')

    formValue.value.description = 'Train'

    expect(guard.hasUnsavedChanges.value).toBe(false)
  })

  it('accepts the current form value as the new initial value', () => {
    const formValue = ref({ description: 'Train' })
    const guard = useUnsavedChangesGuard(formValue)

    formValue.value.description = 'Taxi'
    expect(guard.hasUnsavedChanges.value).toBe(true)

    guard.resetInitialValue()

    expect(guard.hasUnsavedChanges.value).toBe(false)
  })
})
