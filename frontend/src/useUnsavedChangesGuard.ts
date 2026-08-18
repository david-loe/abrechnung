import type { Ref } from 'vue'
import { computed, nextTick, ref, toRaw } from 'vue'

function unwrapReactiveValues(value: unknown, seen = new WeakMap<object, object>()) {
  const rawValue = toRaw(value)
  if (rawValue === null || typeof rawValue !== 'object') {
    return rawValue
  }

  const seenValue = seen.get(rawValue)
  if (seenValue) {
    return seenValue
  }

  if (Array.isArray(rawValue)) {
    const unwrappedValue: unknown[] = []
    seen.set(rawValue, unwrappedValue)
    for (const item of rawValue) {
      unwrappedValue.push(unwrapReactiveValues(item, seen))
    }
    return unwrappedValue
  }

  if (rawValue instanceof Map) {
    const unwrappedValue = new Map()
    seen.set(rawValue, unwrappedValue)
    for (const [key, item] of rawValue) {
      unwrappedValue.set(unwrapReactiveValues(key, seen), unwrapReactiveValues(item, seen))
    }
    return unwrappedValue
  }

  if (rawValue instanceof Set) {
    const unwrappedValue = new Set()
    seen.set(rawValue, unwrappedValue)
    for (const item of rawValue) {
      unwrappedValue.add(unwrapReactiveValues(item, seen))
    }
    return unwrappedValue
  }

  const prototype = Object.getPrototypeOf(rawValue)
  if (prototype !== Object.prototype && prototype !== null) {
    return rawValue
  }

  const unwrappedValue: Record<string, unknown> = {}
  seen.set(rawValue, unwrappedValue)
  for (const [key, item] of Object.entries(rawValue)) {
    unwrappedValue[key] = unwrapReactiveValues(item, seen)
  }
  return unwrappedValue
}

export function cloneFormValue<T>(value: T) {
  return structuredClone(unwrapReactiveValues(value)) as T
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
