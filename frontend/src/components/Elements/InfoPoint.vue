<template>
  <i class="bi bi-info-circle-fill text-primary" data-bs-toggle="tooltip" :data-bs-title="text" ref="icon"></i>
</template>

<script lang="ts">
import { Tooltip } from 'bootstrap'
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'InfoPoint',
  data() {
    return {
      tooltip: new Tooltip('test')
    }
  },
  components: {},
  props: { text: { type: String, required: true } },
  mounted() {
    //this.tooltip = new Tooltip(this.$refs.icon as Element)
  },
  watch: {
    text: function () {
      this.tooltip.setContent({ '.tooltip-inner': this.text })
    }
  }
})
</script>

<style></style>
