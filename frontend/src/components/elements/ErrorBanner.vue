<template>
  <div v-if="isValidationError(error)" class="alert alert-warning alert-dismissible fade show" role="alert">
    <strong>{{ error._message }}</strong> {{ error }}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'

interface RequestError {
  message: string
}

interface ValidationError extends RequestError {
  _message: string
  name: 'ValidationError'
  errors: {
    [path: string]: {
      path: string
      message: string
      kind: string
      name: string
    }
  }
}

export default defineComponent({
  name: 'ErrorBanner',
  props: { error: { type: Object as PropType<RequestError> } },
  methods: {
    isValidationError(error: RequestError | undefined): error is ValidationError {
      return Boolean(error) && (error as ValidationError).name === 'ValidationError'
    }
  }
})
</script>

<style></style>
