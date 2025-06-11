<template>
  <v-select
    :options="advances"
    :modelValue="modelValue"
    :placeholder="placeholder"
    @update:modelValue="(v: AdvanceSimple | AdvanceSimple[] | null) => emit('update:modelValue', v)"
    :filter="filter"
    :getOptionKey="(option: AdvanceSimple) => option._id"
    :getOptionLabel="(option: AdvanceSimple) => option.name"
    :disabled="disabled"
    :multiple="multiple"
    style="min-width: 160px">
    <template #option="{ name, budget, balance, project }">
      <div class="row align-items-center">
        <div class="col text-truncate">
          {{ `${name} [${project.identifier}]` }}
        </div>
        <div class="col-auto px-1">
          <span>{{ $formatter.money(balance) }}</span>
        </div>
        <div v-if="balance.amount !== budget.amount" class="col-auto px-1 opacity-75">
          <span>{{ $formatter.money(budget) }}</span>
        </div>
      </div>
    </template>
    <template #selected-option="{ name, balance, project }">
      <div class="row align-items-center">
        <div class="col-auto text-truncate" style="max-width: 220px">
          {{ `${name} [${project.identifier}]` }}
        </div>
        <div class="col-auto opacity-75">
          <span>{{ $formatter.money(balance) }}</span>
        </div>
      </div>
    </template>
    <template v-if="required" #search="{ attributes, events }">
      <input class="vs__search" :required="!modelValue" v-bind="attributes" v-on="events" />
    </template>
    <template #no-options="{ search, searching, loading }">
      <span v-if="search">{{ t('alerts.noData.searchX', { X: search }) }}</span>
      <span v-else>{{ t('alerts.noData.advanceForUserX', { X: `${owner?.name?.givenName} ${owner?.name?.familyName}` }) }}</span>
    </template>
  </v-select>
</template>

<script setup lang="ts">
import { onMounted, PropType, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Base64 } from '@/../../common/scripts'
import { AdvanceSimple, AdvanceState, idDocumentToId, UserWithName } from '@/../../common/types.js'
import API from '@/api'

// Props
const props = defineProps({
  modelValue: { type: [Object, Array] as PropType<AdvanceSimple | AdvanceSimple[]> },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  multiple: { type: Boolean, default: false },
  owner: { type: Object as PropType<UserWithName> },
  endpointPrefix: { type: String, default: '' }
})

// Emits
const emit = defineEmits<(e: 'update:modelValue', value: AdvanceSimple | AdvanceSimple[] | null) => void>()

const { t } = useI18n()

const advances = ref([] as AdvanceSimple[])

// Filter method
function filter(options: AdvanceSimple[], search: string): AdvanceSimple[] {
  const term = search.toLowerCase()
  return options.filter((option) => option.name.toLowerCase().includes(term) || option.budget.amount.toString().includes(term))
}

async function getAdvances(ownerId: string | undefined) {
  const filter: Partial<Record<keyof AdvanceSimple, string | number | null | { $gte: number }>> = {
    state: { $gte: AdvanceState.APPROVED },
    settledOn: null
  }
  if (ownerId) filter.owner = ownerId
  const response = await API.getter<AdvanceSimple[]>(`${props.endpointPrefix}advance`, {
    filterJSON: Base64.encode(JSON.stringify(filter))
  })
  const result = response.ok
  if (result) {
    return result.data
  }
  return []
}

onMounted(async () => {
  advances.value = await getAdvances(idDocumentToId(props.owner))
})

watch(
  () => props.owner,
  async () => {
    advances.value = await getAdvances(idDocumentToId(props.owner))
  }
)
</script>

<style></style>
