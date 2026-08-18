<template>
  <span>{{ parts.primary }}</span>
  <template v-if="parts.secondary">
    <span>&nbsp;-&nbsp;</span>
    <span class="text-muted">{{ parts.secondary }}</span>
  </template>
</template>

<script setup lang="ts">
import { Money } from 'abrechnung-common/types.js'
import { computed } from 'vue'
import { formatter } from '@/formatter.js'

const props = defineProps<{ money: Money }>()
const parts = computed(() => formatter.moneyDisplayParts(props.money))
</script>
