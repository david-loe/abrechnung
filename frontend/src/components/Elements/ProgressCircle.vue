<template>
  <div>
    <svg width="38" height="38">
      <circle cx="19" cy="19" r="15.9" transform="rotate(-90 19 19)"/>
      <text x="19" y="19" text-anchor="middle" dominant-baseline="central" font-size="11">
        {{ progress + '%' }}
      </text>
    </svg>
  </div>
</template>
  
<script>
export default {
  name: 'ProgressCircle',
  props: { progress: { type: Number } },
  data() {
    return {
      dashoffset: 50
    }
  },
  methods: {
    calc() {
      this.dashoffset = 100 - this.progress
    },
  },
  beforeMount() {
    this.calc()
  }
}
</script>
  
<style scoped>
circle {
  fill: #EBF7DE;
  stroke: #C8E9A0;
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