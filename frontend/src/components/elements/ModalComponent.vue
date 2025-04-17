<template>
  <div class="modal fade" ref="modal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-lg modal-fullscreen-sm-down">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ $props.header }}</h5>
          <button
            type="button"
            class="btn-close"
            @click="
              () => {
                $emit('beforeClose')
                hideModal()
              }
            "></button>
        </div>
        <div class="modal-body">
          <slot></slot>
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import { Modal } from 'bootstrap'
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'ModalComponent',
  emits: ['beforeClose'],
  data() {
    return {
      modal: undefined as Modal | undefined
    }
  },
  props: {
    header: String
  },
  methods: {
    hideModal() {
      this.modal?.hide()
    }
  },
  mounted() {
    const modalEl = this.$refs.modal as HTMLElement
    if (modalEl) {
      this.modal = new Modal(modalEl, {})
      modalEl.addEventListener('hide.bs.modal', () => this.$emit('beforeClose'))
    }
  },
  beforeUnmount() {
    this.hideModal()
  }
})
</script>
