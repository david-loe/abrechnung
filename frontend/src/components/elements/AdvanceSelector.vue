<template>
  <v-select
    :options="advances"
    :modelValue="modelValue"
    :placeholder="placeholder"
    @update:modelValue="(v: AdvanceSimple | AdvanceSimple[] | null) => {setByUser = true; emit('update:modelValue', v)}"
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
          <span>{{ formatter.money(balance) }}</span>
        </div>
        <div v-if="balance.amount !== budget.amount" class="col-auto px-1 opacity-75">
          <span>{{ formatter.money(budget) }}</span>
        </div>
      </div>
    </template>
    <template #selected-option="{ name, balance, project }">
      <div class="row align-items-center">
        <div class="col-auto text-truncate" style="max-width: 220px">
          {{ `${name} [${project.identifier}]` }}
        </div>
        <div class="col-auto opacity-75">
          <span>{{ formatter.money(balance) }}</span>
        </div>
      </div>
    </template>
    <template v-if="required" #search="{ attributes, events }">
      <input class="vs__search" :required="!modelValue" v-bind="attributes" v-on="events" />
    </template>
    <template #no-options="{ search, searching, loading }">
      <span v-if="search">{{ t('alerts.noData.searchX', { X: search }) }}</span>
      <span v-else>{{ t('alerts.noData.advanceForUserX', { X: formatter.name(owner?.name) }) }}</span>
    </template>
  </v-select>
</template>

<script setup lang="ts">
import { Base64 } from 'abrechnung-common/scripts.js'
import { AdvanceSimple, AdvanceState, idDocumentToId, ProjectSimple, UserWithName } from 'abrechnung-common/types.js'
import { onMounted, PropType, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import API from '@/api'
import { formatter } from '@/formatter.js'

// Props
const props = defineProps({
  modelValue: { type: [Object, Array] as PropType<AdvanceSimple | AdvanceSimple[]> },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  multiple: { type: Boolean, default: false },
  owner: { type: Object as PropType<UserWithName<string>> },
  project: { type: Object as PropType<ProjectSimple<string>> },
  endpointPrefix: { type: String, default: '' },
  setDefault: { type: Boolean, default: true }
})

let setByUser = props.modelValue && (!props.multiple || (Array.isArray(props.modelValue) && props.modelValue.length > 0))
let defaultFor = { userId: null as null | string, projectId: null as null | string }

// Emits
const emit = defineEmits<(e: 'update:modelValue', value: AdvanceSimple | AdvanceSimple[] | null) => void>()

const { t } = useI18n()

const advances = ref([] as AdvanceSimple[])

// Filter method
function filter(options: AdvanceSimple[], search: string): AdvanceSimple[] {
  const term = search.toLowerCase()
  return options.filter(
    (option) =>
      option.name.toLowerCase().includes(term) ||
      formatter.money(option.budget).includes(term) ||
      option.project.identifier.toString().includes(term)
  )
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

function setDefaultAdvances(availableAdvances: AdvanceSimple[]) {
  if (
    !setByUser &&
    props.owner &&
    props.project &&
    availableAdvances.length > 0 &&
    (defaultFor.userId !== idDocumentToId(props.owner) || defaultFor.projectId !== idDocumentToId(props.project))
  ) {
    const advancesForProject = availableAdvances.filter((a) => a.project._id === idDocumentToId(props.project))
    if (advancesForProject.length > 0) {
      if (props.multiple) {
        emit('update:modelValue', advancesForProject)
      } else {
        emit('update:modelValue', advancesForProject[0])
      }
      defaultFor = { userId: idDocumentToId(props.owner), projectId: idDocumentToId(props.project) }
    }
  }
}

onMounted(async () => {
  advances.value = await getAdvances(idDocumentToId(props.owner))
  setDefaultAdvances(advances.value)
})

watch(
  () => props.owner,
  async (value, oldValue) => {
    if (value && oldValue && idDocumentToId(value) !== idDocumentToId(oldValue)) {
      emit('update:modelValue', [])
    }
    advances.value = await getAdvances(idDocumentToId(props.owner))
    setDefaultAdvances(advances.value)
  }
)
watch(
  () => props.project,
  async (value, oldValue) => {
    if (value && oldValue && idDocumentToId(value) !== idDocumentToId(oldValue)) {
      emit('update:modelValue', [])
    }
    advances.value = await getAdvances(idDocumentToId(props.owner))
    setDefaultAdvances(advances.value)
  }
)
</script>

<style></style>
