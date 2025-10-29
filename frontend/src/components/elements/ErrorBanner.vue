<template>
  <div v-if="isValidationError(props.error)" class="alert alert-warning alert-dismissible fade show" role="alert">
    <strong>{{ t('alerts.' + props.error.name) + ':' }}</strong>
    <span v-for="e in props.error.errors">
      <br >
      {{ t('alerts.' + e.message) }}
      <small>
        (
        <span v-for="(part, index) of e.path.split('.')">
          <span v-if="index !== 0"> ➡ </span>
          {{ /^\d+$/.test(part) ? '#' + (Number(part) + 1) : t('labels.' + part) }}
        </span>
        )
      </small>
    </span>
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  </div>
</template>

<script lang="ts" setup>
import { PropType } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

export interface RequestError {
  message: string
}

interface ValidationError extends RequestError {
  _message: string
  name: 'ValidationError'
  errors: { [path: string]: { path: string; message: string; kind: string; name: string } }
}

const props = defineProps({ error: { type: Object as PropType<RequestError> } })

function isValidationError(error: RequestError | undefined): error is ValidationError {
  return Boolean(error) && (error as ValidationError).name === 'ValidationError'
}
</script>

<style></style>
