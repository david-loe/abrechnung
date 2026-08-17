import type { Ref } from 'vue'
import { computed, ref } from 'vue'

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

  function confirmNavigation(message: string) {
    return !hasUnsavedChanges.value || globalThis.confirm(message)
  }

  return { confirmNavigation, hasUnsavedChanges, resetInitialValue }
}
