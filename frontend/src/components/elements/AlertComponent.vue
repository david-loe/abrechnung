<template>
  <div class="position-absolute top-0 end-0" style="height: 100%">
    <div class="position-sticky top-0 pt-2 pe-2" style="z-index: 1100">
      <div
        v-for="(alert, index) of API.alerts"
        :key="alert.id"
        :class="'alert alert-' + alert.type + ' alert-dismissible ms-auto'"
        role="alert"
        style="z-index: 1100; max-width: 250px; max-height: 150px; overflow-y: hidden">
        <strong>
          <i v-if="alert.type === 'danger'" class="bi bi-x-octagon-fill"></i>
          <i v-else-if="alert.type === 'success'" class="bi bi-check-circle-fill"></i>
          {{ alert.title }}{{ alert.title && alert.message ? ': ' : '' }}
        </strong>
        {{ alert.message }}
        <div class="progress position-absolute top-0 end-0" style="height: 5px; width: 100%">
          <div
            :class="'progress-bar bg-' + alert.type"
            role="progressbar"
            id="alert-progress"
            aria-label="Danger example"
            :style="'animation-duration: ' + (alert.ttl ? alert.ttl : 5000) + 'ms;'"></div>
        </div>
        <button type="button" class="btn-close" @click="API.alerts.splice(index, 1)"></button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import API from '@/api.js'
</script>

<style scoped>
@keyframes run {
  0% {
    width: 0%;
  }

  100% {
    width: 100%;
  }
}

#alert-progress {
  animation-name: run;
  animation-timing-function: linear;
}
</style>
