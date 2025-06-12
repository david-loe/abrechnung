<template>
  <TooltipElement :text="text">
    <i class="bi bi-info-circle-fill text-primary"></i>
  </TooltipElement>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import TooltipElement from '@/components/elements/TooltipElement.vue'

export default defineComponent({ name: 'InfoPoint', components: { TooltipElement }, props: { text: { type: String, required: true } } })
</script>

<style></style>
