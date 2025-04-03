<template>
  <ListElement class="mb-3" ref="list" :endpoint="endpoint" :filter="filter" :headers="headers" :columns-to-hide="props.columnsToHide">
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
            <option v-for="state of travelStates" :value="state">{{ t('states.' + state) }}</option>
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
      <span v-if="props.makeNameNoLink">
        {{ travel.name }}
      </span>
      <template v-else>
        <template v-if="endpoint == 'travel' && (travel.state === 'rejected' || travel.state === 'appliedFor')">
          <a
            class="link-body-emphasis link-underline-opacity-0 link-underline-opacity-75-hover text-truncate"
            style="cursor: pointer"
            @click="emits('clickedApplied', travel)">
            {{ travel.name }}
          </a>
        </template>
        <template v-else>
          <router-link
            :to="'/' + endpoint + '/' + travel._id"
            class="link-body-emphasis link-underline-opacity-0 link-underline-opacity-75-hover text-truncate">
            {{ travel.name }}
          </router-link>
        </template>
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
    <template #item-addUp.total.amount="{ addUp }">
      <TooltipElement
        html
        :text="`${t('labels.lumpSums')}: ${$formatter.money(addUp.lumpSums)}<br>
        ${t('labels.expenses')}: ${$formatter.money(addUp.expenses)}`">
        {{ $formatter.money(addUp.total) }}
      </TooltipElement>
    </template>
    <template #item-addUp.balance.amount="{ addUp }">
      <TooltipElement
        html
        :text="`${t('labels.lumpSums')}: ${$formatter.money(addUp.lumpSums)}<br>
        ${t('labels.expenses')}: ${$formatter.money(addUp.expenses)}<br>
        ${t('labels.advance')}: ${$formatter.money(addUp.advance, { func: (x) => x * -1 })}`">
        {{ $formatter.money(addUp.balance) }}
      </TooltipElement>
    </template>
    <template #item-report="{ _id, name }">
      <a class="btn btn-primary btn-sm" :href="reportLink(_id)" :download="name + '.pdf'">
        <i class="bi bi-download"></i>
      </a>
    </template>
    <template #item-updatedAt="{ updatedAt }">
      {{ $formatter.dateTime(updatedAt) }}
    </template>
  </ListElement>
</template>

<script lang="ts" setup>
import { TravelSimple, TravelState, travelStates } from '@/../../common/types'
import CountrySelector from '@/components/elements/CountrySelector.vue'
import ListElement from '@/components/elements/ListElement.vue'
import PlaceElement from '@/components/elements/PlaceElement.vue'
import ProgressCircle from '@/components/elements/ProgressCircle.vue'
import ProjectSelector from '@/components/elements/ProjectSelector.vue'
import StateBadge from '@/components/elements/StateBadge.vue'
import TooltipElement from '@/components/elements/TooltipElement.vue'
import UserSelector from '@/components/elements/UserSelector.vue'
import { bp } from '@/helper'
import { ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Header } from 'vue3-easy-data-table'

const { t } = useI18n()

const props = defineProps<{
  endpoint: string
  stateFilter?: TravelState
  columnsToHide?: string[]
  makeNameNoLink?: boolean
}>()

const emits = defineEmits<{ clickedApplied: [travel: TravelSimple] }>()

const headers: Header[] = [
  //@ts-ignore
  { text: t('labels.name'), value: 'name' },
  { text: t('labels.state'), value: 'state' }
]
if (window.innerWidth > bp.md) {
  headers.push(
    //@ts-ignore
    { text: t('labels.destinationPlace'), value: 'destinationPlace' },
    { text: t('labels.startDate'), value: 'startDate', sortable: true },
    { text: t('labels.project'), value: 'project.identifier' },
    { text: t('labels.total'), value: 'addUp.total.amount' },
    { text: t('labels.balance'), value: 'addUp.balance.amount' },
    { text: t('labels.owner'), value: 'owner' },
    { text: t('labels.editor'), value: 'editor' },
    { text: t('labels.updatedAt'), value: 'updatedAt', sortable: true },
    { text: t('labels.report'), value: 'report' }
  )
}

const getEmptyFilter = () =>
  ({
    name: { $regex: undefined, $options: 'i' },
    owner: undefined,
    state: undefined,
    'destinationPlace.country': undefined,
    project: undefined
  } as { [key: string]: string | undefined | null | { $regex: string | undefined; $options: string } })

const filter = ref(getEmptyFilter())

if (props.stateFilter) {
  filter.value.state = props.stateFilter
}
const reportLink = (_id: string) => {
  return import.meta.env.VITE_BACKEND_URL + '/' + props.endpoint + '/report?_id=' + _id
}

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

const list = useTemplateRef('list')
function loadFromServer() {
  if (list.value) {
    list.value.loadFromServer()
  }
}
defineExpose({ loadFromServer })
</script>

<style></style>
