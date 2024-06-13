<template>
  <div class="modal fade" id="modal" tabindex="-1" aria-labelledby="modalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-lg modal-fullscreen-sm-down">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ $props.header }}</h5>
          <button type="button" class="btn-close" @click="$emit('hideModal')"></button>
        </div>
        <div v-if="showModalBody" class="modal-body">
          <slot></slot>
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'ModalComponent',
  emits: ['hideModal'],
  beforeUnmount() {
    this.$emit('hideModal')
  },
  props: {
    header: String,
    showModalBody: {
      type: Boolean,
      default: true
    }
  }
})
</script>
<style lang=""></style>
