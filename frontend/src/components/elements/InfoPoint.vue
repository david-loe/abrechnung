<template>
  <TooltipElement :text="text">
    <i class="bi bi-info-circle-fill text-primary"></i>
  </TooltipElement>
</template>

<script lang="ts">
import TooltipElement from '@/components/elements/TooltipElement.vue'
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'InfoPoint',
  components: { TooltipElement },
  props: { text: { type: String, required: true } }
})
</script>

<style></style>
