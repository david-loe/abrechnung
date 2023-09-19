<template>
  <div>
    <svg width="38" height="38">
      <circle cx="19" cy="19" r="15.9" transform="rotate(-90 19 19)" />
      <text x="19" y="19" text-anchor="middle" dominant-baseline="central" font-size="11">
        {{ progress + '%' }}
      </text>
    </svg>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'ProgressCircle',
  props: { progress: { type: Number, required: true } },
  data() {
    return {
      dashoffset: 50
    }
  },
  methods: {
    calc(): void {
      this.dashoffset = 100 - this.progress
    }
  },
  beforeMount() {
    this.calc()
  },
  watch: {
    progress: function () {
      this.calc()
    }
  }
})
</script>

<style scoped>
circle {
  fill: #ebf7de;
  stroke: #c8e9a0;
  stroke-width: 3;
  stroke-dasharray: 100;
  stroke-dashoffset: v-bind('dashoffset');
  animation: rotate 0.5s ease-out 1;
}

@keyframes rotate {
  from {
    stroke-dashoffset: 100;
  }
  to {
    stroke-dashoffset: v-bind('dashoffset');
  }
}
</style>
