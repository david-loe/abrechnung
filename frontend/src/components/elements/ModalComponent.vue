<template>
  <div>
    <slot></slot>
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'ModalComponent',
  emits: ['hideModal'],
  beforeUnmount() {
    this.$emit('hideModal')
  }
}) 
</script>
<style lang="">

</style>