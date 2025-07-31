<template>
  <ListElement
    class="mb-3"
    ref="list"
    :endpoint="props.endpoint"
    :filter="filter"
    :headers="headers"
    :columns-to-hide="props.columnsToHide"
    :rowsItems="props.rowsItems"
    :rowsPerPage="props.rowsPerPage"
    :items-selected="props.itemsSelected"
    :dbKeyPrefix="props.dbKeyPrefix"
    @update:items-selected="(v) => emits('update:itemsSelected',(v as HealthCareCostSimple[]))"
    @loaded="emits('loaded')">
    <template #header-name="header">
      <div class="filter-column">
        {{ t(header.text) }}
        <span style="cursor: pointer" @click="(e) => clickFilter('name', e)">
          <i v-if="showFilter.name" class="bi bi-funnel-fill"></i>
          <i v-else class="bi bi-funnel"></i>
        </span>
        <div v-if="showFilter.name" @click.stop>
          <input type="text" class="form-control" v-model="(filter.name as any).$regex" />
        </div>
      </div>
    </template>
    <template #header-state="header">
      <div class="filter-column">
        {{ t(header.text) }}
        <span style="cursor: pointer" @click="(e) => clickFilter('state', e)">
          <i v-if="showFilter.state" class="bi bi-funnel-fill"></i>
          <i v-else class="bi bi-funnel"></i>
        </span>
        <div v-if="showFilter.state" @click.stop>
          <select class="form-select" v-model="filter.state">
            <option disabled value=""></option>
            <option v-for="state of healthCareCostStates" :value="state">{{ t('states.' + HealthCareCostState[state]) }}</option>
          </select>
        </div>
      </div>
    </template>
    <template #header-insurance.name="header">
      <div class="filter-column">
        {{ t(header.text) }}
        <span style="cursor: pointer" @click="(e) => clickFilter('insurance', e)">
          <i v-if="showFilter.insurance" class="bi bi-funnel-fill"></i>
          <i v-else class="bi bi-funnel"></i>
        </span>
        <div v-if="showFilter.insurance" @click.stop>
          <HealthInsuranceSelector v-model="filter.insurance as any"></HealthInsuranceSelector>
        </div>
      </div>
    </template>
    <template #header-project.identifier="header">
      <div class="filter-column">
        {{ t(header.text) }}
        <span style="cursor: pointer" @click="(e) => clickFilter('project', e)">
          <i v-if="showFilter.project" class="bi bi-funnel-fill"></i>
          <i v-else class="bi bi-funnel"></i>
        </span>
        <div v-if="showFilter.project" @click.stop>
          <ProjectSelector v-model="(filter.project as any).$in[0]" :orgSelectSplit="5"></ProjectSelector>
        </div>
      </div>
    </template>
    <template #header-organisation="header">
      <div class="filter-column">
        {{ t(header.text) }}
        <span style="cursor: pointer" @click="(e) => clickFilter('project.organisation', e)">
          <i v-if="showFilter['project.organisation']" class="bi bi-funnel-fill"></i>
          <i v-else class="bi bi-funnel"></i>
        </span>
        <div v-if="showFilter['project.organisation']" @click.stop>
          <ProjectsOfOrganisationSelector v-model="(filter.project as any).$in" reduce-to-id></ProjectsOfOrganisationSelector>
        </div>
      </div>
    </template>
    <template #header-owner="header">
      <div class="filter-column">
        <div class="d-flex align-items-stretch">
          {{ t(header.text) }}
          <span style="cursor: pointer" @click="(e) => clickFilter('owner', e)">
            <i v-if="showFilter.owner" class="bi bi-funnel-fill mx-1"></i>
            <i v-else class="bi bi-funnel mx-1"></i>
          </span>
        </div>
        <div v-if="showFilter.owner" @click.stop>
          <UserSelector v-model="filter.owner as any"></UserSelector>
        </div>
      </div>
    </template>
    <template #header-updatedAt="header">
      <div class="filter-column">
        <div class="d-flex align-items-stretch">
          {{ t(header.text) }}
          <span style="cursor: pointer" @click="(e) => clickFilter('updatedAt', e)">
            <i v-if="showFilter.updatedAt" class="bi bi-funnel-fill mx-1"></i>
            <i v-else class="bi bi-funnel mx-1"></i>
          </span>
        </div>
        <div v-if="showFilter.updatedAt" @click.stop>
          <DateInput v-model="(filter.updatedAt as any).$gt" :max="new Date()" with-time></DateInput>
        </div>
      </div>
    </template>
    <template #item-name="{ name, _id }">
      <span v-if="props.makeNameNoLink">
        {{ name }}
      </span>
      <router-link
        v-else
        :to="'/' + endpoint + '/' + _id"
        class="link-body-emphasis link-underline-opacity-0 link-underline-opacity-75-hover">
        {{ name }}
      </router-link>
    </template>
    <template #item-editor="{ editor }">
      <span :title="formatter.name(editor.name)">
        {{ formatter.name(editor.name, 'short') }}
      </span>
    </template>
    <template #item-owner="{ owner }">
      <span :title="formatter.name(owner.name)">
        {{ formatter.name(owner.name, 'short') }}
      </span>
    </template>
    <template #item-state="{ state }">
      <StateBadge :state="state" :StateEnum="HealthCareCostState" style="display: inline-block"></StateBadge>
    </template>
    <template #item-organisation="{ project }">
      <span v-if="APP_DATA">{{ getById(project.organisation, APP_DATA.organisations)?.name }}</span>
    </template>
    <template #item-addUp.totalTotal="{ addUp }">
      {{ formatter.baseCurrency(getTotalTotal(addUp)) }}
    </template>
    <template #item-addUp.totalBalance="report">
      <TooltipElement>
        {{ formatter.baseCurrency(getTotalBalance(report.addUp)) }}
        <template v-if="report.addUp.length > 1 || report.addUp[0].advance.amount > 0" #content>
          <AddUpTable noBootstrapTable :add-up="report.addUp" :project="report.project" :showAdvanceOverflow="false"></AddUpTable>
        </template>
      </TooltipElement>
    </template>
    <template #item-report="{ _id, name }">
      <button
        class="btn btn-primary btn-sm"
        @click="
          showFile({ endpoint: `${props.endpoint}/report`, params: { _id }, filename: `${name}.pdf`, isDownloading: isDownloadingFn() })
        "
        :title="t('labels.report')"
        :disabled="isDownloading === _id">
        <span v-if="isDownloading === _id" class="spinner-border spinner-border-sm"></span>
        <i v-else class="bi bi-file-earmark-pdf"></i>
      </button>
    </template>
    <template #item-updatedAt="{ updatedAt }">
      {{ formatter.dateTime(updatedAt) }}
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
import { ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Header } from 'vue3-easy-data-table'
import { getById, getTotalBalance, getTotalTotal } from '@/../../common/scripts.js'
import { HealthCareCostSimple, HealthCareCostState, healthCareCostStates, Log } from '@/../../common/types.js'
import APP_LOADER from '@/appData.js'
import AddUpTable from '@/components/elements/AddUpTable.vue'
import DateInput from '@/components/elements/DateInput.vue'
import HealthInsuranceSelector from '@/components/elements/HealthInsuranceSelector.vue'
import ListElement, { Filter } from '@/components/elements/ListElement.vue'
import ProjectSelector from '@/components/elements/ProjectSelector.vue'
import ProjectsOfOrganisationSelector from '@/components/elements/ProjectsOfOrganisationSelector.vue'
import StateBadge from '@/components/elements/StateBadge.vue'
import TooltipElement from '@/components/elements/TooltipElement.vue'
import UserSelector from '@/components/elements/UserSelector.vue'
import { formatter } from '@/formatter.js'
import { bp, showFile } from '@/helper.js'

const { t } = useI18n()

const props = defineProps<{
  endpoint: string
  stateFilter?: HealthCareCostState | { $gte: HealthCareCostState }
  columnsToHide?: string[]
  makeNameNoLink?: boolean
  rowsItems?: number[]
  rowsPerPage?: number
  itemsSelected?: HealthCareCostSimple[]
  dbKeyPrefix?: string
}>()

const emits = defineEmits<{ loaded: []; 'update:itemsSelected': [HealthCareCostSimple[]] }>()

const isDownloading = ref('')
const isDownloadingFn = () => isDownloading
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
  { text: 'labels.name', value: 'name' },
  { text: 'labels.state', value: 'state' }
]
if (window.innerWidth > bp.md) {
  headers.push(
    //@ts-ignore
    { text: 'labels.healthInsurance', value: 'insurance.name' },
    { text: 'labels.project', value: 'project.identifier' },
    { text: 'labels.organisation', value: 'organisation' },
    { text: 'labels.total', value: 'addUp.totalTotal' },
    { text: 'labels.balance', value: 'addUp.totalBalance' },
    { text: 'labels.owner', value: 'owner' },
    { text: 'labels.editor', value: 'editor' },
    { text: 'labels.updatedAt', value: 'updatedAt', sortable: true },
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
    insurance: undefined,
    project: { $in: [undefined] },
    updatedAt: { $gt: undefined }
  }) as Filter

const filter = ref(getEmptyFilter())

if (props.stateFilter !== undefined) {
  filter.value.state = props.stateFilter
}

const showFilter = ref({
  name: false,
  owner: false,
  state: false,
  insurance: false,
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
