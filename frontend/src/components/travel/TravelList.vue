<template>
  <ListElement
    class="mb-3"
    ref="list"
    :endpoint="endpoint"
    :filter="filter"
    :headers="headers"
    :columns-to-hide="props.columnsToHide"
    :rowsItems="props.rowsItems"
    :rowsPerPage="props.rowsPerPage"
    @loaded="emits('loaded')">
    <template #header-name="header">
      <div class="filter-column">
        {{ header.text }}
        <span style="cursor: pointer" @click="(e) => clickFilter('name', e)">
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
        <span style="cursor: pointer" @click="(e) => clickFilter('state', e)">
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
        <span style="cursor: pointer" @click="(e) => clickFilter('destinationPlace.country', e)">
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
        <span style="cursor: pointer" @click="(e) => clickFilter('project', e)">
          <i v-if="showFilter.project" class="bi bi-funnel-fill"></i>
          <i v-else class="bi bi-funnel"></i>
        </span>
        <div v-if="showFilter.project">
          <ProjectSelector v-model="(filter.project as any).$in[0]" :orgSelectSplit="5"></ProjectSelector>
        </div>
      </div>
    </template>
    <template #header-organisation="header">
      <div class="filter-column">
        {{ header.text }}
        <span style="cursor: pointer" @click="(e) => clickFilter('project.organisation', e)">
          <i v-if="showFilter['project.organisation']" class="bi bi-funnel-fill"></i>
          <i v-else class="bi bi-funnel"></i>
        </span>
        <div v-if="showFilter['project.organisation']">
          <ProjectsOfOrganisationSelector v-model="(filter.project as any).$in" reduce-to-id></ProjectsOfOrganisationSelector>
        </div>
      </div>
    </template>
    <template #header-owner="header">
      <div class="filter-column">
        <div class="d-flex align-items-stretch">
          {{ header.text }}
          <span style="cursor: pointer" @click="(e) => clickFilter('owner', e)">
            <i v-if="showFilter.owner" class="bi bi-funnel-fill mx-1"></i>
            <i v-else class="bi bi-funnel mx-1"></i>
          </span>
        </div>
        <div v-if="showFilter.owner">
          <UserSelector v-model="filter.owner as any"></UserSelector>
        </div>
      </div>
    </template>
    <template #header-updatedAt="header">
      <div class="filter-column">
        <div class="d-flex align-items-stretch">
          {{ header.text }}
          <span style="cursor: pointer" @click="(e) => clickFilter('updatedAt', e)">
            <i v-if="showFilter.updatedAt" class="bi bi-funnel-fill mx-1"></i>
            <i v-else class="bi bi-funnel mx-1"></i>
          </span>
        </div>
        <div v-if="showFilter.updatedAt">
          <DateInput v-model="(filter.updatedAt as any).$gt" :max="new Date()" with-time></DateInput>
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
            class="link-body-emphasis link-underline-opacity-0 link-underline-opacity-75-hover"
            style="cursor: pointer"
            @click="emits('clickedApplied', travel)">
            {{ travel.name }}
          </a>
        </template>
        <template v-else>
          <router-link
            :to="'/' + endpoint + '/' + travel._id"
            class="link-body-emphasis link-underline-opacity-0 link-underline-opacity-75-hover">
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
        {{ owner.name.familyName + ', ' + owner.name.givenName.substring(0, 1) + '.' }}
      </span>
    </template>
    <template #item-state="{ progress, state }">
      <StateBadge :state="state" style="display: inline-block"></StateBadge>
      <ProgressCircle class="ms-3" v-if="state === 'approved'" :progress="progress" style="display: inline-block"></ProgressCircle>
    </template>
    <template #item-organisation="{ project }">
      <span v-if="APP_DATA">{{ getById(project.organisation, APP_DATA.organisations)?.name }}</span>
    </template>
    <template #item-addUp.totalTotal="{ addUp }">
      {{ $formatter.baseCurrency(getTotalTotal(addUp)) }}
    </template>
    <template #item-addUp.totalBalance="{ addUp }">
      {{ $formatter.baseCurrency(getTotalBalance(addUp)) }}
    </template>
    <template #item-report="{ _id, name }">
      <a class="btn btn-primary btn-sm" :href="reportLink(_id)" :download="name + '.pdf'" :title="t('labels.report')">
        <i class="bi bi-download"></i>
      </a>
    </template>
    <template #item-updatedAt="{ updatedAt }">
      {{ $formatter.dateTime(updatedAt) }}
    </template>
    <template #item-bookingRemark="{ bookingRemark }">
      <span v-if="bookingRemark">
        <TooltipElement :text="bookingRemark">
          <i class="bi bi-chat-left-text"></i>
        </TooltipElement>
      </span>
    </template>
    <!-- Standard-Slot weiterleiten -->

    <template v-for="(_, slot) in $slots" v-slot:[slot]="scope">
      <slot :name="slot" v-bind="scope"></slot>
    </template>
  </ListElement>
</template>

<script lang="ts" setup>
import { getById, getTotalBalance, getTotalTotal } from '@/../../common/scripts.js'
import { TravelSimple, TravelState, travelStates } from '@/../../common/types.js'
import APP_LOADER from '@/appData.js'
import CountrySelector from '@/components/elements/CountrySelector.vue'
import DateInput from '@/components/elements/DateInput.vue'
import ListElement, { Filter } from '@/components/elements/ListElement.vue'
import PlaceElement from '@/components/elements/PlaceElement.vue'
import ProgressCircle from '@/components/elements/ProgressCircle.vue'
import ProjectSelector from '@/components/elements/ProjectSelector.vue'
import ProjectsOfOrganisationSelector from '@/components/elements/ProjectsOfOrganisationSelector.vue'
import StateBadge from '@/components/elements/StateBadge.vue'
import TooltipElement from '@/components/elements/TooltipElement.vue'
import UserSelector from '@/components/elements/UserSelector.vue'
import { bp } from '@/helper.js'
import { ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Header } from 'vue3-easy-data-table'

const { t } = useI18n()

const props = defineProps<{
  endpoint: string
  stateFilter?: TravelState
  columnsToHide?: string[]
  makeNameNoLink?: boolean
  rowsItems?: number[]
  rowsPerPage?: number
}>()

const emits = defineEmits<{ clickedApplied: [travel: TravelSimple]; loaded: [] }>()

const list = useTemplateRef('list')
function loadFromServer() {
  if (list.value) {
    list.value.loadFromServer()
  }
}
defineExpose({ loadFromServer })

await APP_LOADER.loadData()
const APP_DATA = APP_LOADER.data

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
    { text: t('labels.organisation'), value: 'organisation' },
    { text: t('labels.total'), value: 'addUp.totalTotal' },
    { text: t('labels.balance'), value: 'addUp.totalBalance' },
    { text: t('labels.owner'), value: 'owner' },
    { text: t('labels.editor'), value: 'editor' },
    { text: t('labels.updatedAt'), value: 'updatedAt', sortable: true },
    { text: '', value: 'report', width: 40 },
    { text: '', value: 'bookingRemark', width: 25 }
  )
}

if (APP_DATA.value && APP_DATA.value.organisations.length <= 1) {
  const index = headers.findIndex((header) => header.value === 'organisation')
  if (index !== -1) {
    headers.splice(index, 1)
  }
}

const getEmptyFilter = () =>
  ({
    name: { $regex: undefined, $options: 'i' },
    owner: undefined,
    state: undefined,
    'destinationPlace.country': undefined,
    project: { $in: [undefined] },
    updatedAt: { $gt: undefined }
  }) as Filter

const filter = ref(getEmptyFilter())

if (props.stateFilter) {
  filter.value.state = props.stateFilter
}
const reportLink = (_id: string) => {
  return `${import.meta.env.VITE_BACKEND_URL}/${props.endpoint}/report?_id=${_id}`
}

const showFilter = ref({
  name: false,
  owner: false,
  state: false,
  'destinationPlace.country': false,
  project: false,
  'project.organisation': false,
  updatedAt: false
})

function clickFilter(header: keyof typeof showFilter.value, event?: MouseEvent) {
  event?.stopPropagation()
  if (showFilter.value[header]) {
    showFilter.value[header] = false
    let filterHeader = header
    if (filterHeader === 'project.organisation') {
      filterHeader = 'project'
    }
    filter.value[filterHeader] = getEmptyFilter()[header]
  } else {
    showFilter.value[header] = true
  }
}
</script>

<style scoped>
.tooltip-inner {
  white-space: pre-wrap;
}
</style>
