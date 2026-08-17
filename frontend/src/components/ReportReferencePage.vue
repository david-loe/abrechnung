<template></template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import APP_LOADER from '@/dataLoader.js'
import { getRouteForReportReference } from '@/helper.js'

const props = defineProps<{ reference: string }>()
const router = useRouter()
const appData = await APP_LOADER.loadData()
const reportRoute = await getRouteForReportReference(appData.user, props.reference)

await router.replace(reportRoute ?? '/user')
</script>
