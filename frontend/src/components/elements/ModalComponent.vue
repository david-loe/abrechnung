<template>
  <div class="modal fade" id="modal" tabindex="-1" aria-labelledby="modalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-lg modal-fullscreen-sm-down">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ $props.header }}</h5>
          <button type="button" class="btn-close" @click="hideModal()"></button>
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
  data() {
    return {
      modal: undefined as Modal | undefined
    }
  },
  props: {
    header: String,
    showModalBody: {
      type: Boolean,
      default: true
    }
  },
  methods: {
    hideModal() {
      this.modal?.hide()
    }
  },
  mounted() {
    const modalEl = document.getElementById('modal')
    console.log('mounted in ModalComponent')
    if (modalEl) {
      this.modal = new Modal(modalEl, {})
    }
  },
  beforeUnmount() {
    this.hideModal()
  }
})
</script>
