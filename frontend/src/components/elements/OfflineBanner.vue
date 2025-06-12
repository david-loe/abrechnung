<template>
  <div id="offline-banner" class="bg-danger-subtle" style="width: 100%; display: flex; justify-content: center">
    Du bist Offline. Die Daten befinden sich unter Umständen nicht auf dem neusten Stand.
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
export default defineComponent({ name: 'OfflineComponent' })
</script>
