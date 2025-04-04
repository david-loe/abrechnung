<template>
  <div class="container">
    <h1 class="mb-3">{{ $t('accesses.refunded/healthCareCost') }}</h1>
    <HealthCareCostList class="mb-5" endpoint="refunded/healthCareCost" :columns-to-hide="['state', 'updatedAt']" make-name-no-link>
    </HealthCareCostList>
  </div>
</template>

<script lang="ts" setup>
import APP_LOADER from '@/appData.js'
import { onMounted } from 'vue'
import HealthCareCostList from './HealthCareCostList.vue'

onMounted(async () => {
  await APP_LOADER.loadData()
})
</script>
