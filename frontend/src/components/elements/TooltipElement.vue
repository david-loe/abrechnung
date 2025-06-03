<template>
  <div style="display: none" ref="contentHolder">
    <slot name="content" />
  </div>

  <span ref="tooltipTrigger">
    <slot />
  </span>
</template>

<script lang="ts">
import { Tooltip } from 'bootstrap'
import { defineComponent, nextTick } from 'vue'

export default defineComponent({
  name: 'TooltipElement',
  props: {
    text: { type: String, default: '' },
    html: { type: Boolean, default: false }
  },
  data() {
    return {
      tooltipInstance: null as Tooltip | null
    }
  },
  async mounted() {
    await nextTick()

    let htmlContent = (this.$refs.contentHolder as HTMLElement)?.innerHTML?.trim()

    // fix vue3-easy-data-table issue adding style="display: none;" to all th elements
    htmlContent = htmlContent.replace(/style="display:\s*none;?"/g, '')

    const hasHTMLContent = Boolean(htmlContent)
    if (hasHTMLContent || this.text) {
      this.tooltipInstance = new Tooltip(this.$refs.tooltipTrigger as Element, {
        trigger: 'click hover focus',
        html: hasHTMLContent || this.html,
        sanitize: !hasHTMLContent,
        title: htmlContent || this.text
      })
    }
  },
  watch: {
    text(newVal) {
      this.tooltipInstance?.setContent({ '.tooltip-inner': newVal })
    }
  },
  beforeUnmount() {
    this.tooltipInstance?.dispose()
  }
})
</script>

<style></style>
