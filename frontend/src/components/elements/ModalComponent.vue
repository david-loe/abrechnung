<template>
  <div class="modal fade" ref="modal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-lg modal-fullscreen-sm-down">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ props.header }}</h5>
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
import { defineEmits, defineProps, onMounted, onUnmounted, ref, useTemplateRef } from 'vue'

const emit = defineEmits<{ afterClose: [] }>()
const modalObj = ref(null as Modal | null)
const modalRef = useTemplateRef('modal')

defineExpose({ modal: modalObj, hideModal })

const props = defineProps({ header: String })

function hideModal() {
  modalObj.value?.hide()
}
const emitAfterClose = () => emit('afterClose')
onMounted(() => {
  if (modalRef.value) {
    modalObj.value = new Modal(modalRef.value, {})
    modalRef.value.addEventListener('hidden.bs.modal', emitAfterClose)
  }
})
onUnmounted(() => {
  modalRef.value?.removeEventListener('hidden.bs.modal', emitAfterClose)
  modalObj.value?.dispose()
})
</script>
