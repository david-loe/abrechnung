<template>
  <div class="container">
    <h1 class="mb-3">{{ $t('accesses.refunded/travel') }}</h1>
    <TravelList class="mb-5" endpoint="refunded/travel" :columns-to-hide="['state']" make-name-no-link> </TravelList>
  </div>
</template>

<script lang="ts" setup>
import APP_LOADER from '@/appData.js'
import { onMounted } from 'vue'
import TravelList from './TravelList.vue'

onMounted(async () => {
  await APP_LOADER.loadData()
})
</script>
