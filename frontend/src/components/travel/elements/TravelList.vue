<template>
  <EasyDataTable
    class="mb-3"
    :rows-items="[5, 15, 25]"
    :rows-per-page="5"
    v-model:server-options="serverOptions"
    :server-items-length="serverItemsLength"
    :loading="loading"
    :items="items"
    sort-by="name"
    :headers="headers"
    alternating
    :preventContextMenuRow="false">
    <template #header-name="header">
      <div class="filter-column">
        {{ header.text }}
        <span style="cursor: pointer" @click="clickFilter('name')">
          <i v-if="showFilter.name" class="bi bi-funnel-fill"></i>
          <i v-else class="bi bi-funnel"></i>
        </span>
        <div v-if="showFilter.name">
          <input type="text" class="form-control" v-model="(filter.name as any).$regex" />
        </div>
      </div>
    </template>
    <template #header-state="header">
      <div class="filter-column">
        {{ header.text }}
        <span style="cursor: pointer" @click="clickFilter('state')">
          <i v-if="showFilter.state" class="bi bi-funnel-fill"></i>
          <i v-else class="bi bi-funnel"></i>
        </span>
        <div v-if="showFilter.state">
          <select class="form-select" v-model="filter.state">
            <option disabled value=""></option>
            <option v-for="state of travelStates" :value="state">{{ i18n.global.t('states.' + state) }}</option>
          </select>
        </div>
      </div>
    </template>
    <template #header-destinationPlace="header">
      <div class="filter-column">
        {{ header.text }}
        <span style="cursor: pointer" @click="clickFilter('destinationPlace.country')">
          <i v-if="showFilter['destinationPlace.country']" class="bi bi-funnel-fill"></i>
          <i v-else class="bi bi-funnel"></i>
        </span>
        <div v-if="showFilter['destinationPlace.country']">
          <CountrySelector v-model="filter['destinationPlace.country'] as any"></CountrySelector>
        </div>
      </div>
    </template>
    <template #header-project.identifier="header">
      <div class="filter-column">
        {{ header.text }}
        <span style="cursor: pointer" @click="clickFilter('project')">
          <i v-if="showFilter.project" class="bi bi-funnel-fill"></i>
          <i v-else class="bi bi-funnel"></i>
        </span>
        <div v-if="showFilter.project">
          <ProjectSelector v-model="filter.project as any"></ProjectSelector>
        </div>
      </div>
    </template>
    <template #header-owner="header">
      <div class="filter-column">
        {{ header.text }}
        <span style="cursor: pointer" @click="clickFilter('owner')">
          <i v-if="showFilter.owner" class="bi bi-funnel-fill"></i>
          <i v-else class="bi bi-funnel"></i>
        </span>
        <div v-if="showFilter.owner">
          <UserSelector v-model="filter.owner as any"></UserSelector>
        </div>
      </div>
    </template>
    <template #item-name="travel: TravelSimple">
      <template v-if="travel.state === 'rejected' || travel.state === 'appliedFor'">
        <a
          class="link-dark link-underline-opacity-0 link-underline-opacity-75-hover text-truncate"
          style="cursor: pointer"
          @click="emits('clickedApplied', travel)">
          {{ travel.name }}
        </a>
      </template>
      <template v-else>
        <router-link
          :to="'/' + endpoint + '/' + travel._id"
          class="link-dark link-underline-opacity-0 link-underline-opacity-75-hover text-truncate">
          {{ travel.name }}
        </router-link>
      </template>
    </template>
    <template #item-startDate="{ startDate }">
      {{ $formatter.simpleDate(startDate) }}
    </template>
    <template #item-destinationPlace="{ destinationPlace }">
      <PlaceElement :place="destinationPlace"></PlaceElement>
    </template>
    <template #item-editor="{ editor }">
      <span :title="editor.name.givenName + ' ' + editor.name.familyName">
        {{ editor.name.givenName + ' ' + editor.name.familyName.substring(0, 1) + '.' }}
      </span>
    </template>
    <template #item-owner="{ owner }">
      <span :title="owner.name.givenName + ' ' + owner.name.familyName">
        {{ owner.name.givenName + ' ' + owner.name.familyName.substring(0, 1) + '.' }}
      </span>
    </template>
    <template #item-state="{ progress, state }">
      <StateBadge :state="state" style="display: inline-block"></StateBadge>
      <ProgressCircle class="ms-3" v-if="state === 'approved'" :progress="progress" style="display: inline-block"></ProgressCircle>
    </template>
  </EasyDataTable>
</template>

<script lang="ts" setup>
import API from '@/api.js'
import CountrySelector from '@/components/elements/CountrySelector.vue'
import ProjectSelector from '@/components/elements/ProjectSelector.vue'
import UserSelector from '@/components/elements/UserSelector.vue'
import { bp } from '@/helper'
import i18n from '@/i18n.js'
import { ref, toRaw, watch } from 'vue'
import type { Header, Item, ServerOptions } from 'vue3-easy-data-table'
import { Base64 } from '../../../../../common/scripts'
import { TravelSimple, TravelState, travelStates } from '../../../../../common/types'
import PlaceElement from '../../elements/PlaceElement.vue'
import ProgressCircle from '../../elements/ProgressCircle.vue'
import StateBadge from '../../elements/StateBadge.vue'

const props = defineProps<{
  endpoint: string
  stateFilter?: TravelState
  columnsToHide?: string[]
}>()

const emits = defineEmits<{ clickedApplied: [travel: TravelSimple] }>()

const headers: Header[] = [
  //@ts-ignore
  { text: i18n.global.t('labels.name'), value: 'name' },
  { text: i18n.global.t('labels.state'), value: 'state' }
]
if (window.innerWidth > bp.md) {
  headers.push(
    //@ts-ignore
    { text: i18n.global.t('labels.destinationPlace'), value: 'destinationPlace' },
    { text: i18n.global.t('labels.startDate'), value: 'startDate', sortable: true },
    { text: i18n.global.t('labels.project'), value: 'project.identifier' },
    { text: i18n.global.t('labels.owner'), value: 'owner' },
    { text: i18n.global.t('labels.editor'), value: 'editor' }
  )
}
if (props.columnsToHide) {
  for (const columnToHide of props.columnsToHide) {
    for (let i = 0; i <= headers.length; i++) {
      if (headers[i].value === columnToHide) {
        headers.splice(i, 1)
        break
      }
    }
  }
}

const items = ref<Item[]>([])
const loading = ref(false)
const serverItemsLength = ref(0)
const serverOptions = ref<ServerOptions>({
  page: 1,
  rowsPerPage: 5
})

const getEmptyFilter = () =>
  ({
    name: { $regex: undefined, $options: 'i' },
    owner: undefined,
    state: undefined,
    'destinationPlace.country': undefined,
    project: undefined
  } as { [key: string]: string | undefined | null | { $regex: string | undefined; $options: string } })

const filter = ref(getEmptyFilter())

const showFilter = ref({
  name: false,
  owner: false,
  state: false,
  'destinationPlace.country': false,
  project: false
})

function clickFilter(header: keyof typeof showFilter.value) {
  if (showFilter.value[header]) {
    showFilter.value[header] = false
    filter.value[header] = getEmptyFilter()[header]
  } else {
    showFilter.value[header] = true
  }
}
let oldFilterValue = ''
const loadFromServer = async (additionalFilter?: any) => {
  loading.value = true

  const params = { page: serverOptions.value.page, limit: serverOptions.value.rowsPerPage } as any

  if (serverOptions.value.sortBy && serverOptions.value.sortType && typeof serverOptions.value.sortBy === 'string') {
    const sortObj = {} as any
    sortObj[serverOptions.value.sortBy] = serverOptions.value.sortType
    console.log(sortObj)
    params.sortJSON = Base64.encode(JSON.stringify(sortObj))
  }

  let filter = additionalFilter || {}
  if (props.stateFilter) {
    Object.assign(filter, { state: props.stateFilter })
  }
  if (Object.keys(filter).length > 0) {
    params.filterJSON = Base64.encode(JSON.stringify(filter))
  }

  let result = (await API.getter<any[]>(props.endpoint, params)).ok
  if (result) {
    items.value = result.data
    serverItemsLength.value = result.meta.count
  } else {
    items.value = []
    serverItemsLength.value = 0
  }
  loading.value = false
}
const prepareFilter = (filter: any) => {
  const filterCopy = structuredClone(toRaw(filter))
  for (const filterKey in filterCopy) {
    if (filterCopy[filterKey] === null || filterCopy[filterKey] === undefined) {
      delete filterCopy[filterKey]
    } else if (typeof filterCopy[filterKey] === 'object' && !filterCopy[filterKey].$regex && filterCopy[filterKey].$options) {
      delete filterCopy[filterKey]
    }
  }
  return filterCopy
}

// initial load
loadFromServer()

watch(
  serverOptions,
  (value) => {
    loadFromServer()
  },
  { deep: true }
)
watch(
  filter,
  (value) => {
    const preparedFilter = prepareFilter(filter.value)
    const filterJSON = JSON.stringify(preparedFilter)
    if (oldFilterValue !== filterJSON) {
      oldFilterValue = filterJSON
      loadFromServer(preparedFilter)
    }
  },
  { deep: true }
)
defineExpose({ loadFromServer })
</script>

<style></style>
