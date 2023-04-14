<template>
  <i class="bi bi-info-circle-fill text-primary" data-bs-toggle="tooltip" :data-bs-title="text" ref="icon"></i>
</template>

<script>
import { Tooltip } from 'bootstrap'
export default {
  name: 'InfoPoint',
  data() {
    return {
      tooltip: undefined
    }
  },
  components: {},
  props: { text: { type: String } },
  mounted() {
    this.tooltip = new Tooltip(this.$refs.icon)
  },
  watch: {
    text: function () {
      this.tooltip.setContent({ '.tooltip-inner': this.text })
    },
  }
}
</script>

<style></style>