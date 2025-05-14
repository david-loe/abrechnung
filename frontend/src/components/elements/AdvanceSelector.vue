<template>
  <v-select
    :options="advances"
    :modelValue="modelValue"
    :placeholder="placeholder"
    @update:modelValue="(v: AdvanceSimple | AdvanceSimple[] | null) => emit('update:modelValue', v)"
    :filter="filter"
    :getOptionLabel="(option: AdvanceSimple) => option.name"
    :disabled="disabled"
    :multiple="multiple"
    style="min-width: 160px">
    <template #option="{ name, budget, runningBalance }">
      <div class="row align-items-center">
        <div class="col text-truncate">
          {{ name }}
        </div>
        <div class="col-auto px-1">
          <span>{{ $formatter.money(runningBalance) }}</span>
        </div>
        <div v-if="runningBalance.amount !== budget.amount" class="col-auto px-1 opacity-75">
          <span>{{ $formatter.money(budget) }}</span>
        </div>
      </div>
    </template>
    <template #selected-option="{ name, runningBalance }">
      <div class="row align-items-center">
        <div class="col-auto text-truncate" style="max-width: 220px">
          {{ name }}
        </div>
        <div class="col-auto opacity-75">
          <span>{{ $formatter.money(runningBalance) }}</span>
        </div>
      </div>
    </template>
    <template v-if="required" #search="{ attributes, events }">
      <input class="vs__search" :required="!modelValue" v-bind="attributes" v-on="events" />
    </template>
    <template #no-options="{ search, searching, loading }">
      <span v-if="search">{{ t('alerts.noData.searchX', { X: search }) }}</span>
      <span v-else>{{ t('alerts.noData.advance', { X: projectId, Y: ownerId }) }}</span>
    </template>
  </v-select>
</template>

<script setup lang="ts">
import { AdvanceSimple } from '@/../../common/types.js'
import API from '@/api'
import { PropType, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Base64 } from '../../../../common/scripts'

// Props
const props = defineProps({
  modelValue: { type: [Object, Array] as PropType<AdvanceSimple | AdvanceSimple[]> },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  multiple: { type: Boolean, default: false },
  ownerId: { type: String },
  projectId: { type: String }
})

// Emits
const emit = defineEmits<(e: 'update:modelValue', value: AdvanceSimple | AdvanceSimple[] | null) => void>()

const { t } = useI18n()

const advances = ref([] as AdvanceSimple[])

// Filter method
function filter(options: AdvanceSimple[], search: string): AdvanceSimple[] {
  const term = search.toLowerCase()
  return options.filter((option) => option.name.toLowerCase().includes(term) || option.budget.amount?.toString().includes(term))
}

async function getAdvances(ownerId: string | undefined, projectId: string | undefined) {
  const filter: Partial<Record<keyof AdvanceSimple, string>> = { state: 'approved' }
  if (ownerId) filter.owner = ownerId
  if (projectId) filter.project = projectId
  const response = await API.getter<AdvanceSimple[]>('advance', { filterJSON: Base64.encode(JSON.stringify(filter)) })
  const result = response.ok
  if (result) {
    return result.data
  }
  return []
}

onMounted(async () => {
  advances.value = await getAdvances(props.ownerId, props.projectId)
})

watch(
  () => props.ownerId,
  async () => {
    advances.value = await getAdvances(props.ownerId, props.projectId)
  }
)
watch(
  () => props.projectId,
  async () => {
    advances.value = await getAdvances(props.ownerId, props.projectId)
  }
)
</script>

<style></style>
