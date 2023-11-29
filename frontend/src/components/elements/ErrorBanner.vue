<template>
  <div v-if="isValidationError(error)" class="alert alert-warning alert-dismissible fade show" role="alert">
    <strong>{{ $t('alerts.' + error.name) + ':' }}</strong>
    <span v-for="e in error.errors">
      <br />
      {{ $t('alerts.' + e.message) }}
      <small>
        (
        <span v-for="(part, index) of e.path.split('.')">
          <span v-if="index !== 0"> ➡ </span>
          {{ /^\d+$/.test(part) ? '#' + (Number(part) + 1) : $t('labels.' + part) }}
        </span>
        )
      </small>
    </span>
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
