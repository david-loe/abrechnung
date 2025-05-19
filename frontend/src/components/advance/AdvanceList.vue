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
            <option v-for="state of advanceStates" :value="state">{{ t('states.' + state) }}</option>
          </select>
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
          <ProjectSelector v-model="(filter.project as any).$in[0]" :orgSelectSplit="5"></ProjectSelector>
        </div>
      </div>
    </template>
    <template #header-organisation="header">
      <div class="filter-column">
        {{ header.text }}
        <span style="cursor: pointer" @click="clickFilter('project.organisation')">
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
        {{ header.text }}
        <span style="cursor: pointer" @click="clickFilter('owner')">
          <i v-if="showFilter.owner" class="bi bi-funnel-fill"></i>
          <i v-else class="bi bi-funnel"></i>
        </span>
        <div v-if="showFilter.owner">
          <UserSelector v-model="(filter.owner as any)"></UserSelector>
        </div>
      </div>
    </template>
    <template #header-log.appliedFor.date="header">
      <div class="filter-column">
        {{ header.text }}
        <span style="cursor: pointer" @click="clickFilter('log.appliedFor.date')">
          <i v-if="showFilter['log.appliedFor.date']" class="bi bi-funnel-fill"></i>
          <i v-else class="bi bi-funnel"></i>
        </span>
        <div v-if="showFilter['log.appliedFor.date']">
          <DateInput v-model="(filter['log.appliedFor.date'] as any).$gt" :max="new Date()"></DateInput>
        </div>
      </div>
    </template>
    <template #item-name="advance: AdvanceSimple">
      <span v-if="props.makeNameNoLink">
        {{ advance.name }}
      </span>
      <a
        v-else
        class="link-body-emphasis link-underline-opacity-0 link-underline-opacity-75-hover"
        style="cursor: pointer"
        @click="emits('clicked', advance)">
        {{ advance.name }}
      </a>
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
    <template #item-state="{ state }">
      <StateBadge :state="state" style="display: inline-block"></StateBadge>
    </template>
    <template #item-organisation="{ project }">
      <span v-if="APP_DATA">{{ getById(project.organisation, APP_DATA.organisations)?.name }}</span>
    </template>
    <template #item-budget="{ budget }">
      {{ $formatter.money(budget) }}
    </template>
    <template #item-balance="{ balance }">
      {{ $formatter.money(balance) }}
    </template>
    <template #item-report="{ _id, name }">
      <a class="btn btn-primary btn-sm" :href="reportLink(_id)" :download="name + '.pdf'" :title="t('labels.report')">
        <i class="bi bi-download"></i>
      </a>
    </template>
    <template #item-log.appliedFor.date="{ log }">
      {{ $formatter.dateTime(log.appliedFor?.date) }}
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
import { getById } from '@/../../common/scripts.js'
import { AdvanceSimple, AdvanceState, advanceStates } from '@/../../common/types.js'
import APP_LOADER from '@/appData.js'
import DateInput from '@/components/elements/DateInput.vue'
import ListElement, { Filter } from '@/components/elements/ListElement.vue'
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
  stateFilter?: AdvanceState | { $in: AdvanceState[] }
  columnsToHide?: string[]
  makeNameNoLink?: boolean
  rowsItems?: number[]
  rowsPerPage?: number
}>()

const emits = defineEmits<{ loaded: []; clicked: [AdvanceSimple] }>()

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
  { text: t('labels.name'), value: 'name' },
  { text: t('labels.state'), value: 'state' }
]
if (window.innerWidth > bp.md) {
  headers.push(
    { text: t('labels.project'), value: 'project.identifier' },
    { text: t('labels.organisation'), value: 'organisation' },
    { text: t('labels.budget'), value: 'budget' },
    { text: t('labels.balance'), value: 'balance' },
    { text: t('labels.owner'), value: 'owner' },
    { text: t('labels.editor'), value: 'editor' },
    { text: t('labels.approvedOn'), value: 'log.appliedFor.date' },
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

const reportLink = (_id: string) => {
  return `${import.meta.env.VITE_BACKEND_URL}/${props.endpoint}/report?_id=${_id}`
}

const getEmptyFilter = () =>
  ({
    name: { $regex: undefined, $options: 'i' },
    owner: undefined,
    state: undefined,
    project: { $in: [undefined] },
    'log.appliedFor.date': { $gt: undefined }
  }) as Filter

const filter = ref(getEmptyFilter())

if (props.stateFilter) {
  filter.value.state = props.stateFilter
}

const showFilter = ref({
  name: false,
  owner: false,
  state: false,
  project: false,
  'project.organisation': false,
  'log.appliedFor.date': false
})

function clickFilter(header: keyof typeof showFilter.value) {
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
