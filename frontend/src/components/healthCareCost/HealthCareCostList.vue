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
            <option v-for="state of healthCareCostStates" :value="state">{{ t('states.' + state) }}</option>
          </select>
        </div>
      </div>
    </template>
    <template #header-insurance.name="header">
      <div class="filter-column">
        {{ header.text }}
        <span style="cursor: pointer" @click="clickFilter('insurance')">
          <i v-if="showFilter.insurance" class="bi bi-funnel-fill"></i>
          <i v-else class="bi bi-funnel"></i>
        </span>
        <div v-if="showFilter.insurance">
          <HealthInsuranceSelector v-model="filter.insurance as any"></HealthInsuranceSelector>
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
    <template #item-name="{ name, _id }">
      <router-link
        :to="'/' + endpoint + '/' + _id"
        class="link-body-emphasis link-underline-opacity-0 link-underline-opacity-75-hover text-truncate">
        {{ name }}
      </router-link>
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
    <template #item-state="{ state }">
      <StateBadge :state="state" style="display: inline-block"></StateBadge>
    </template>
    <template #item-addUp="{ addUp }">
      {{ $formatter.money(addUp.total) }}
    </template>
    <template #item-report="{ _id, name }">
      <a class="btn btn-primary" :href="reportLink(_id)" :download="name + '.pdf'">
        <i class="bi bi-download"></i>
      </a>
    </template>
    <template #item-updatedAt="{ updatedAt }">
      {{ $formatter.dateTime(updatedAt) }}
    </template>
  </ListElement>
</template>

<script lang="ts" setup>
import { HealthCareCostState, healthCareCostStates } from '@/../../common/types'
import ListElement from '@/components/elements/ListElement.vue'
import StateBadge from '@/components/elements/StateBadge.vue'
import UserSelector from '@/components/elements/UserSelector.vue'
import { bp } from '@/helper'
import { ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Header } from 'vue3-easy-data-table'
import HealthInsuranceSelector from '../elements/HealthInsuranceSelector.vue'

const { t } = useI18n()

const props = defineProps<{
  endpoint: string
  stateFilter?: HealthCareCostState
  columnsToHide?: string[]
}>()

const reportLink = (_id: string) => {
  return import.meta.env.VITE_BACKEND_URL + '/' + props.endpoint + '/report?_id=' + _id
}

const headers: Header[] = [
  //@ts-ignore
  { text: t('labels.name'), value: 'name' },
  { text: t('labels.state'), value: 'state' }
]
if (window.innerWidth > bp.md) {
  headers.push(
    //@ts-ignore
    { text: t('labels.healthInsurance'), value: 'insurance.name' },
    { text: t('labels.total'), value: 'addUp' },
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
    insurance: undefined
  } as { [key: string]: string | undefined | null | { $regex: string | undefined; $options: string } })

const filter = ref(getEmptyFilter())

if (props.stateFilter) {
  filter.value.state = props.stateFilter
}

const showFilter = ref({
  name: false,
  owner: false,
  state: false,
  insurance: false
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
