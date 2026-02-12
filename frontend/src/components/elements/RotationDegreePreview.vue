<template>
  <svg class="rotation-badge" viewBox="0 0 32 32" aria-hidden="true">
    <circle :cx="CENTER" :cy="CENTER" :r="RADIUS" class="badge-circle" />
    <text :x="CENTER" :y="textY" class="badge-text">{{ props.degree }}°</text>
    <path :d="arcPath" class="badge-path" />
    <polyline :points="arrowPoints" class="badge-arrow" />
  </svg>
</template>

<script lang="ts" setup>
import { computed } from 'vue'

const props = defineProps<{ degree: 90 | 180 | 270 }>()

const CENTER = 16
const RADIUS = 10.6
const textY = CENTER + 2.3
// End point at 12 o'clock
const END_DEG = -90

function toRadians(deg: number) {
  return (deg * Math.PI) / 180
}

function pointOnCircle(deg: number, radius = RADIUS) {
  const rad = toRadians(deg)
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) }
}

function formatPoint(x: number, y: number) {
  return `${x.toFixed(2)} ${y.toFixed(2)}`
}

const arcPath = computed(() => {
  const startDeg = (((END_DEG - props.degree) % 360) + 360) % 360
  const start = pointOnCircle(startDeg)
  const end = pointOnCircle(END_DEG)
  const largeArcFlag = props.degree > 180 ? 1 : 0
  return `M ${formatPoint(start.x, start.y)} A ${RADIUS} ${RADIUS} 0 ${largeArcFlag} 1 ${formatPoint(end.x, end.y)}`
})

const arrowPoints = computed(() => {
  const tip = pointOnCircle(END_DEG)
  const rad = toRadians(END_DEG)

  // Orient arrowhead along the clockwise tangent of the arc.
  const ux = -Math.sin(rad)
  const uy = Math.cos(rad)

  const headLength = 2.4
  const headWidth = 1.5

  const baseX = tip.x - ux * headLength
  const baseY = tip.y - uy * headLength

  const nx = -uy
  const ny = ux

  const leftX = baseX + nx * headWidth
  const leftY = baseY + ny * headWidth
  const rightX = baseX - nx * headWidth
  const rightY = baseY - ny * headWidth

  return `${leftX.toFixed(2)},${leftY.toFixed(2)} ${tip.x.toFixed(2)},${tip.y.toFixed(2)} ${rightX.toFixed(2)},${rightY.toFixed(2)}`
})
</script>

<style scoped>
.rotation-badge {
  width: 38px;
  height: 38px;
  display: block;
}

.badge-circle {
  fill: none;
  stroke: var(--bs-secondary);
  stroke-width: 1.2;
  opacity: 0.65;
}

.badge-text {
  fill: var(--bs-body-color);
  font-size: 7.2px;
  font-weight: 700;
  text-anchor: middle;
}

.badge-path {
  fill: none;
  stroke: var(--bs-primary);
  stroke-width: 2.4;
  stroke-linecap: round;
}

.badge-arrow {
  fill: none;
  stroke: var(--bs-primary);
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
