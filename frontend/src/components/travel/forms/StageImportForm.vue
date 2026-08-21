<template>
  <form @submit.prevent="selectedSource ? emit('import', selectedSource._id) : null">
    <div class="mb-3">
      <label for="stageImportSource" class="form-label">
        {{ t('labels.travel') }}
        <span class="text-danger">*</span>
      </label>
      <v-select
        input-id="stageImportSource"
        v-model="selectedSource"
        :options="sources"
        :loading="sourcesAreLoading"
        :get-option-key="(source: TravelStageImportSource<string>) => source._id"
        :get-option-label="sourceLabel"
        :placeholder="t('labels.typeToSearch')">
        <template #option="source: TravelStageImportSource<string>">
          <div>
            <div>{{ sourceLabel(source) }}</div>
            <small class="text-secondary">
              {{ `${placeToSimpleString(source.destinationPlace)} · ${formatter.simpleDate(source.startDate)} – ${formatter.simpleDate(source.endDate)}` }}
            </small>
          </div>
        </template>
        <template #no-options>
          <span>{{ t('alerts.noData.stageImportSource') }}</span>
        </template>
        <template #search="{ attributes, events }">
          <input class="vs__search" :required="!selectedSource" v-bind="attributes" v-on="events" >
        </template>
      </v-select>
    </div>
    <div class="mb-1 d-flex align-items-center">
      <button type="submit" class="btn btn-primary me-2" :disabled="loading || sourcesAreLoading || !selectedSource">
        {{ t('labels.import') }}
      </button>
      <span v-if="loading" class="spinner-border spinner-border-sm ms-1 me-3"></span>
      <button type="button" class="btn btn-light" @click="emit('cancel')">{{ t('labels.cancel') }}</button>
    </div>
  </form>
</template>

<script lang="ts" setup>
import { TravelStageImportSource } from 'abrechnung-common/types.js'
import { placeToSimpleString, refNumberToString } from 'abrechnung-common/utils/scripts.js'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import API from '@/api.js'
import { formatter } from '@/formatter.js'

const props = defineProps<{ targetTravelId: string; loading?: boolean }>()
const emit = defineEmits<{ cancel: []; import: [sourceTravelId: string] }>()
const { t } = useI18n()

const selectedSource = ref<TravelStageImportSource<string> | null>(null)
const sources = ref<TravelStageImportSource<string>[]>([])
const sourcesAreLoading = ref(true)

function sourceLabel(source: TravelStageImportSource<string>) {
  return `${refNumberToString(source.reference, 'Travel')} · ${source.name}`
}

onMounted(async () => {
  const result = await API.getter<TravelStageImportSource<string>[]>('travel/stage/import', {
    targetTravelId: props.targetTravelId
  })
  if (result.ok) {
    sources.value = result.ok.data
  }
  sourcesAreLoading.value = false
})
</script>
