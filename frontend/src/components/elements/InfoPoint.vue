<template>
  <TooltipElement :text="props.text">
    <i class="bi bi-info-circle-fill text-primary"></i>
  </TooltipElement>
</template>

<script lang="ts" setup>
import { defineProps } from 'vue'
import TooltipElement from './TooltipElement.vue'

const props = defineProps({ text: { type: String, required: true } })
</script>

<style></style>
