<template>
  <i class="bi bi-info-circle-fill text-primary" data-bs-toggle="tooltip" :data-bs-title="text" :id="id"></i>
</template>

<script>
import { Tooltip } from 'bootstrap'
export default {
  name: 'InfoPoint',
  data() {
    return {
      tooltip: undefined,
      id: null
    }
  },
  components: {},
  props: { text: { type: String } },
  beforeMount () {
    this.id = Math.random()
  },
  mounted() {
    this.tooltipList = new Tooltip(document.getElementById(this.id))
  },
}
</script>

<style>
</style>