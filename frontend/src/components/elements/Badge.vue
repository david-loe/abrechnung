<template>
  <span v-if="style" :class="'badge text-' + style.text" :style="'background-color: ' + style.color + ';'">{{ text }} </span>
  <span v-else class="badge text">
    {{ text }}
  </span>
</template>

<script setup lang="ts">
import { PropType } from 'vue'
import { BadgeStyle } from '@/../../common/types.js'

defineProps({ text: { type: String, required: true }, style: { type: Object as PropType<BadgeStyle> } })
</script>
