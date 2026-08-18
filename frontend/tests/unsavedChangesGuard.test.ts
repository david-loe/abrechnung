import { afterEach, describe, expect, it, vi } from 'vitest'
import { reactive, ref, watch } from 'vue'
import { cloneFormValue, useUnsavedChangesGuard } from '@/useUnsavedChangesGuard.js'

describe('unsaved changes guard', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('clones nested reactive form values without mutating their source', () => {
    const source = reactive({ transport: { type: 'train' }, cost: { positions: [{ amount: 12 }] } })
    const formValue = cloneFormValue(source)

    formValue.transport.type = 'car'
    formValue.cost.positions[0].amount = 24

    expect(source).toEqual({ transport: { type: 'train' }, cost: { positions: [{ amount: 12 }] } })
  })

  it('clones receipt data inside nested reactive values', () => {
    const receipt = new Blob(['receipt'], { type: 'text/plain' })
    const cost = reactive({ positions: [{ amount: 12 }], receipts: [{ name: 'receipt.txt', type: 'text/plain', data: receipt }] })
    const source = { description: 'Train', cost }

    const formValue = cloneFormValue(source)

    expect(formValue.cost).not.toBe(cost)
    expect(formValue.cost.receipts[0].data).toBeInstanceOf(Blob)
    expect(formValue.cost.receipts[0].data.size).toBe(receipt.size)
    formValue.cost.positions[0].amount = 24
    expect(cost.positions[0].amount).toBe(12)
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

  it('detects an added receipt as an unsaved change', () => {
    const formValue = ref({ cost: { receipts: [] as Blob[] } })
    const guard = useUnsavedChangesGuard(formValue)

    formValue.value.cost.receipts.push(new Blob(['receipt'], { type: 'text/plain' }))

    expect(guard.hasUnsavedChanges.value).toBe(true)
  })

  it('accepts form normalizations scheduled by a value change as part of the initial value', async () => {
    const formValue = ref({ transportType: 'train', midnightCountries: [] as string[] })
    const guard = useUnsavedChangesGuard(formValue)
    watch(
      () => formValue.value.transportType,
      () => {
        formValue.value.midnightCountries = ['DE']
      }
    )

    formValue.value = { transportType: 'car', midnightCountries: [] }
    await guard.resetInitialValueAfterUpdate()

    expect(formValue.value.midnightCountries).toEqual(['DE'])
    expect(guard.hasUnsavedChanges.value).toBe(false)

    formValue.value.midnightCountries = ['FR']
    expect(guard.hasUnsavedChanges.value).toBe(true)
  })
})
