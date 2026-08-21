<template>
  <span v-if="count > 0" class="badge rounded-pill text-bg-danger ms-2">{{ count }}</span>
</template>

<script setup lang="ts">
defineProps<{ count: number }>()
</script>
