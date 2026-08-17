<template>
  <div v-if="advance" class="container py-3">
    <div class="d-flex align-items-center mb-3">
      <h2 class="m-0">{{ advance.name }}</h2>
      <RefStringBadge class="ms-2" :number="advance.reference" type="Advance" />
    </div>
    <Advance :advance="advance" endpoint-prefix="admin/" />
  </div>
</template>

<script setup lang="ts">
import { AdvanceSimple } from 'abrechnung-common/types.js'
import { ref, watch } from 'vue'
import API from '@/api.js'
import Advance from '@/components/advance/Advance.vue'
import RefStringBadge from '@/components/elements/RefStringBadge.vue'

const props = defineProps<{ _id: string }>()
const advance = ref<AdvanceSimple<string>>()

async function loadAdvance() {
  const result = (await API.getter<AdvanceSimple<string>>('admin/advance', { _id: props._id })).ok
  advance.value = result?.data
}

await loadAdvance()
watch(() => props._id, loadAdvance)
</script>
