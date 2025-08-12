<template>
  <div class="col-auto" style="max-width: 110px" :title="file.name">
    <div class="border rounded p-2">
      <div class="row justify-content-between m-0">
        <div class="col-auto p-0">
          <button type="button" class="btn btn-sm btn-light" @click="$emit('show')">
            <i class="bi bi-eye"></i>
          </button>
        </div>
        <div class="col-auto p-0">
          <button type="button" class="btn btn-sm btn-light" @click="disabled ? null : $emit('deleted')" :disabled="disabled">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>

      <div class="fs-2 text-center">
        <i class="bi bi-file-earmark-text"></i>
      </div>
      <div class="text-truncate text-center">
        {{ file.name }}
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { DocumentFile } from 'abrechnung-common/types.js'
import { defineComponent, PropType } from 'vue'

export default defineComponent({
  name: 'FileUploadFileElement',
  props: { file: { type: Object as PropType<DocumentFile<string, Blob>>, required: true }, disabled: { type: Boolean, default: false } },
  emits: ['show', 'deleted']
})
</script>
