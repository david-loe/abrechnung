<template>
  <div class="modal fade" ref="modal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-lg modal-fullscreen-sm-down">
      <div class="modal-content">
        <div class="modal-header">
          <slot name="header" :header="props.header">
            <h5 class="modal-title">{{ props.header }}</h5>
          </slot>
          <button type="button" class="btn-close" @click="hideModal"></button>
        </div>
        <div class="modal-body">
          <slot></slot>
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { Modal } from 'bootstrap'
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from 'vue'
import { createModalLifecycle } from './modalLifecycle.js'

const emit = defineEmits<{ afterClose: [] }>()
const modalObj = shallowRef<Modal | null>(null)
let lifecycle: ReturnType<typeof createModalLifecycle> | undefined
const modalRef = useTemplateRef('modal')

defineExpose({ modal: modalObj, hideModal })

const props = defineProps({ header: String })

function hideModal() {
  return lifecycle?.close() ?? Promise.resolve()
}
onMounted(() => {
  if (modalRef.value) {
    modalObj.value = new Modal(modalRef.value, {})
    lifecycle = createModalLifecycle(modalRef.value, modalObj.value, () => emit('afterClose'))
  }
})
onBeforeUnmount(() => lifecycle?.dispose())
</script>
