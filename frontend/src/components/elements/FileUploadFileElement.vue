<template>
  <div class="col-auto" style="max-width: 110px" :title="props.file.name">
    <div class="border rounded p-2">
      <div class="row justify-content-between m-0">
        <div class="col-auto p-0">
          <button type="button" class="btn btn-sm btn-light" @click="emit('show')">
            <i class="bi bi-eye"></i>
          </button>
        </div>
        <div class="col-auto p-0">
          <button type="button" class="btn btn-sm btn-light" @click="props.disabled ? null : emit('deleted')" :disabled="props.disabled">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>

      <div class="fs-2 text-center">
        <i class="bi bi-file-earmark-text"></i>
      </div>
      <div class="text-truncate text-center">
        {{ props.file.name }}
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { DocumentFile } from 'abrechnung-common/types.js'

import { defineEmits, defineProps, PropType } from 'vue'

const props = defineProps({
  file: { type: Object as PropType<DocumentFile<string, Blob>>, required: true },
  disabled: { type: Boolean, default: false }
})
const emit = defineEmits<{ show: []; deleted: [] }>()
</script>
