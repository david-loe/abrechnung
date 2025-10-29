<template>
  <div style="display: none" ref="contentHolder">
    <slot name="content" />
  </div>

  <span ref="tooltipTrigger">
    <slot />
  </span>
</template>

<script lang="ts" setup>
import { Tooltip } from 'bootstrap'
import { defineProps, nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'

const props = defineProps({ text: { type: String, default: '' }, html: { type: Boolean, default: false } })
const tooltipInstance = ref(null as Tooltip | null)

const contentHolderRef = useTemplateRef('contentHolder')
const tooltipTriggerRef = useTemplateRef('tooltipTrigger')

onMounted(async () => {
  await nextTick()

  let htmlContent = contentHolderRef.value?.innerHTML?.trim()

  // fix vue3-easy-data-table issue adding style="display: none;" to all th elements
  htmlContent = htmlContent?.replace(/style="display:\s*none;?"/g, '')

  const hasHTMLContent = Boolean(htmlContent)
  if ((hasHTMLContent || props.text) && tooltipTriggerRef.value) {
    tooltipInstance.value = new Tooltip(tooltipTriggerRef.value, {
      trigger: 'click hover focus',
      html: hasHTMLContent || props.html,
      sanitize: !hasHTMLContent,
      title: htmlContent || props.text
    })
  }
})
watch(
  () => props.text,
  () => {
    tooltipInstance.value?.setContent({ '.tooltip-inner': props.text })
  }
)
onUnmounted(() => {
  tooltipInstance.value?.dispose()
})
</script>

<style></style>
