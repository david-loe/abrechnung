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
    @update:items-selected="(v) => emits('update:itemsSelected',(v as AdvanceSimple[]))"
    @loaded="emits('loaded')"
    :sort-by="sortBy"
    :sort-type="sortType">
    <template #header-reference="header">
      <div class="filter-column">
        {{ t(header.text) }}
        <span class="clickable" @click="(e) => clickFilter('reference', e)">
          <i v-if="showFilter.reference" class="bi bi-funnel-fill"></i>
          <i v-else class="bi bi-funnel"></i>
        </span>
        <div v-if="showFilter.reference" @click.stop>
          <input
            type="text"
            class="form-control"
            @input="(event : Event)=> filter.reference = refStringRegexLax.exec((event.target as HTMLInputElement).value)? refStringToNumber((event.target as HTMLInputElement).value).ref : undefined" >
        </div>
      </div>
    </template>
    <template #header-name="header">
      <div class="filter-column">
        {{ t(header.text) }}
        <span class="clickable" @click="(e) => clickFilter('name', e)">
          <i v-if="showFilter.name" class="bi bi-funnel-fill"></i>
          <i v-else class="bi bi-funnel"></i>
        </span>
        <div v-if="showFilter.name" @click.stop>
          <input type="text" class="form-control" v-model="(filter.name as any).$regex" >
        </div>
      </div>
    </template>
    <template #header-state="header">
      <div class="filter-column">
        {{ t(header.text) }}
        <span class="clickable" @click="(e) => clickFilter('state', e)">
          <i v-if="showFilter.state" class="bi bi-funnel-fill"></i>
          <i v-else class="bi bi-funnel"></i>
        </span>
        <div v-if="showFilter.state" @click.stop>
          <select class="form-select" v-model="filter.state">
            <option disabled value=""></option>
            <option v-for="state of advanceStates" :value="state">{{ t('states.' + AdvanceState[state]) }}</option>
          </select>
        </div>
      </div>
    </template>
    <template #header-project.identifier="header">
      <div class="filter-column">
        {{ t(header.text) }}
        <span class="clickable" @click="(e) => clickFilter('project', e)">
          <i v-if="showFilter.project" class="bi bi-funnel-fill"></i>
          <i v-else class="bi bi-funnel"></i>
        </span>
        <div v-if="showFilter.project" @click.stop>
          <ProjectSelector v-model="(filter.project as any).$in[0]" :orgSelectSplit="5" />
        </div>
      </div>
    </template>
    <template #header-organisation="header">
      <div class="filter-column">
        {{ t(header.text) }}
        <span class="clickable" @click="(e) => clickFilter('project.organisation', e)">
          <i v-if="showFilter['project.organisation']" class="bi bi-funnel-fill"></i>
          <i v-else class="bi bi-funnel"></i>
        </span>
        <div v-if="showFilter['project.organisation']" @click.stop>
          <ProjectsOfOrganisationSelector v-model="(filter.project as any).$in" reduce-to-id />
        </div>
      </div>
    </template>
    <template #header-owner="header">
      <div class="filter-column">
        <div class="d-flex align-items-stretch">
          {{ t(header.text) }}
          <span class="clickable" @click="(e) => clickFilter('owner', e)">
            <i v-if="showFilter.owner" class="bi bi-funnel-fill mx-1"></i>
            <i v-else class="bi bi-funnel mx-1"></i>
          </span>
        </div>
        <div v-if="showFilter.owner" @click.stop>
          <UserSelector v-model="(filter.owner as any)" />
        </div>
      </div>
    </template>
    <template #header-log.30.on="header">
      <div class="filter-column">
        <div class="d-flex align-items-stretch">
          {{ t(header.text) }}
          <span class="clickable" @click="(e) => clickFilter('log.30.on', e)">
            <i v-if="showFilter['log.30.on']" class="bi bi-funnel-fill mx-1"></i>
            <i v-else class="bi bi-funnel mx-1"></i>
          </span>
        </div>
        <div v-if="showFilter['log.30.on']" @click.stop>
          <DateInput v-model="(filter['log.30.on'] as any).$gt" :max="new Date()" with-time />
        </div>
      </div>
    </template>
    <template #item-reference="{reference}">
      <RefStringBadge :number="reference" type="Advance" :show-copy="false" />
    </template>
    <template #item-name="advance: AdvanceSimple">
      <span v-if="props.makeNameNoLink"> {{ advance.name }}</span>
      <a
        v-else
        class="clickable link-body-emphasis link-underline-opacity-0 link-underline-opacity-75-hover"
        @click="emits('clicked', advance)">
        {{ advance.name }}
      </a>
    </template>
    <template #item-editor="{ editor }: AdvanceSimple">
      <span :title="formatter.name(editor.name)"> {{ formatter.name(editor.name, 'short') }}</span>
    </template>
    <template #item-owner="{ owner }: AdvanceSimple">
      <span :title="formatter.name(owner.name)"> {{ formatter.name(owner.name, 'short') }}</span>
    </template>
    <template #item-state="{ state }: AdvanceSimple">
      <StateBadge :state="state" :StateEnum="AdvanceState" style="display: inline-block" />
    </template>
    <template #item-organisation="{ project }: AdvanceSimple<string>">
      <span v-if="APP_DATA">{{ getById(project.organisation, APP_DATA.organisations)?.name }}</span>
    </template>
    <template #item-budget="{ budget }: AdvanceSimple">
      <span class="tnum">{{ formatter.money(budget) }}</span>
    </template>
    <template #item-balance="{ balance }: AdvanceSimple">
      <span class="tnum">{{ formatter.money(balance) }}</span>
    </template>
    <template #item-report="{ _id, name }: AdvanceSimple">
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
    <template #item-updatedAt="{ updatedAt }">{{ formatter.dateTime(updatedAt) }}</template>
    <template #item-log.30.on="{ log }: AdvanceSimple">{{ log[30] ? formatter.dateTime(log[30].on) : '' }}</template>
    <template #item-bookingRemark="{ bookingRemark }: AdvanceSimple">
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
import { AdvanceSimple, AdvanceState, advanceStates, refStringRegexLax } from 'abrechnung-common/types.js'
import { getById, refStringToNumber } from 'abrechnung-common/utils/scripts.js'
import { ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Header, SortType } from 'vue3-easy-data-table'
import DateInput from '@/components/elements/DateInput.vue'
import ListElement, { Filter } from '@/components/elements/ListElement.vue'
import ProjectSelector from '@/components/elements/ProjectSelector.vue'
import ProjectsOfOrganisationSelector from '@/components/elements/ProjectsOfOrganisationSelector.vue'
import RefStringBadge from '@/components/elements/RefStringBadge.vue'
import StateBadge from '@/components/elements/StateBadge.vue'
import TooltipElement from '@/components/elements/TooltipElement.vue'
import UserSelector from '@/components/elements/UserSelector.vue'
import APP_LOADER from '@/dataLoader.js'
import { formatter } from '@/formatter.js'
import { bp, showFile } from '@/helper.js'

const { t } = useI18n()

const props = defineProps<{
  endpoint: string
  stateFilter?: AdvanceState | { $gte: AdvanceState }
  columnsToHide?: string[]
  makeNameNoLink?: boolean
  rowsItems?: number[]
  rowsPerPage?: number
  sortBy?: string
  sortType?: SortType
  itemsSelected?: AdvanceSimple[]
  dbKeyPrefix?: string
}>()

const emits = defineEmits<{ loaded: []; clicked: [AdvanceSimple]; 'update:itemsSelected': [AdvanceSimple[]] }>()

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
  { text: 'Ref', value: 'reference' },
  { text: 'labels.name', value: 'name' },
  { text: 'labels.state', value: 'state' }
]
if (window.innerWidth > bp.md) {
  headers.push(
    { text: 'labels.project', value: 'project.identifier' },
    { text: 'labels.organisation', value: 'organisation' },
    { text: 'labels.budget', value: 'budget' },
    { text: 'labels.balance', value: 'balance' },
    { text: 'labels.owner', value: 'owner' },
    { text: 'labels.editor', value: 'editor' },
    { text: 'labels.updatedAt', value: 'updatedAt', sortable: true },
    { text: 'labels.approvedOn', value: 'log.30.on', sortable: true },
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
    reference: undefined,
    name: { $regex: undefined, $options: 'i' },
    owner: undefined,
    state: undefined,
    project: { $in: [undefined] },
    'log.30.on': { $gt: undefined }
  }) as Filter

const filter = ref(getEmptyFilter())

if (props.stateFilter !== undefined) {
  filter.value.state = props.stateFilter
}

const showFilter = ref({
  reference: false,
  name: false,
  owner: false,
  state: false,
  project: false,
  'project.organisation': false,
  'log.30.on': false
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
