<template>
  <div
    id="offline-banner"
    style="
      background-color: #434343;
      color: #fff;
      width: 100%;
      margin-bottom: 1%;
      display: flex;
      justify-content: center;
      text-align: center;
    ">
    Du bist Offline. Die Daten befinden sich unter Umständen nicht auf dem neusten Stand.
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
export default defineComponent({
  name: 'OfflineComponent'
})
</script>
