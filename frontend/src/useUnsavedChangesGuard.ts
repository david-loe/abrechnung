import type { Ref } from 'vue'
import { computed, nextTick, ref, toRaw } from 'vue'

export function cloneFormValue<T>(value: T) {
  return structuredClone(toRaw(value))
}

function snapshot(value: unknown) {
  return (
    JSON.stringify(value, (_key, currentValue: unknown) => {
      if (currentValue instanceof Blob) {
        return {
          size: currentValue.size,
          type: currentValue.type,
          ...('name' in currentValue ? { name: currentValue.name } : {}),
          ...('lastModified' in currentValue ? { lastModified: currentValue.lastModified } : {})
        }
      }
      return currentValue
    }) ?? 'undefined'
  )
}

export function useUnsavedChangesGuard<T>(formValue: Ref<T>) {
  const initialSnapshot = ref(snapshot(formValue.value))
  const hasUnsavedChanges = computed(() => snapshot(formValue.value) !== initialSnapshot.value)

  function resetInitialValue() {
    initialSnapshot.value = snapshot(formValue.value)
  }

  async function resetInitialValueAfterUpdate() {
    await nextTick()
    resetInitialValue()
  }

  function confirmNavigation(message: string) {
    return !hasUnsavedChanges.value || globalThis.confirm(message)
  }

  return { confirmNavigation, hasUnsavedChanges, resetInitialValue, resetInitialValueAfterUpdate }
}
