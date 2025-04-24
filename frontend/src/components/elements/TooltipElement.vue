<template>
  <span :data-bs-title="text" ref="tooltip" :data-bs-html="html">
    <slot />
  </span>
</template>

<script lang="ts">
import { Tooltip } from 'bootstrap'
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'TooltipElement',
  data() {
    return {
      tooltip: undefined as Tooltip | undefined
    }
  },
  components: {},
  props: { text: { type: String, required: true }, html: { type: Boolean, default: false } },
  mounted() {
    this.tooltip = new Tooltip(this.$refs.tooltip as Element, { trigger: 'click hover focus' })
  },
  watch: {
    text: function () {
      if (this.tooltip) {
        this.tooltip.setContent({ '.tooltip-inner': this.text })
      }
    }
  }
})
</script>

<style></style>
