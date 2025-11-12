<template>
  <div>
    <ListElement class="mb-3" ref="list" endpoint="admin/webhook" :filter="filter" :headers="headers" dbKeyPrefix="admin">
      <template #header-name="header">
        <div class="filter-column">
          {{ t(header.text) }}
          <span class="clickable" @click="clickFilter('name')">
            <i v-if="showFilter.name" class="bi bi-funnel-fill"></i>
            <i v-else class="bi bi-funnel"></i>
          </span>
          <div v-if="showFilter.name" @click.stop>
            <input type="text" class="form-control" v-model="filter.name.$regex" >
          </div>
        </div>
      </template>

      <template #item-isActive="{isActive}:Webhook">{{ isActive? '✅' : '❌' }}</template>
      <template #item-reportType="{reportType}: Webhook">
        <span v-if="APP_DATA" v-for="r of reportType" :title="t('labels.' + r)" class="me-2">
          <i v-for="icon of APP_DATA.displaySettings.reportTypeIcons[r]" :class="`bi bi-${icon}`"></i>
        </span>
      </template>

      <template #item-buttons="webhook">
        <button type="button" class="btn btn-light btn-sm" @click="showForm(webhook)">
          <i class="bi bi-pencil"></i>
        </button>
        <button type="button" class="btn btn-danger btn-sm ms-2" @click="deleteWebhook(webhook)">
          <i class="bi bi-trash"></i>
        </button>
      </template>
    </ListElement>
    <div v-if="_showForm" class="container">
      <Vueform
        :schema="schema"
        v-model="webhookToEdit"
        :sync="true"
        :endpoint="false"
        @submit="(form$: any) => postWebhook(form$.data)"
        @reset="_showForm = false" />
    </div>
    <button v-else type="button" class="btn btn-secondary" @click="showForm()">{{ $t('labels.addX', { X: $t('labels.webhook') }) }}</button>
  </div>
</template>

<script lang="ts" setup>
import { VueformSchema } from '@vueform/vueform'
import { Webhook } from 'abrechnung-common/types.js'
import { Ref, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Header } from 'vue3-easy-data-table'
import API from '@/api.js'
import ListElement, { Filter } from '@/components/elements/ListElement.vue'
import APP_LOADER from '@/dataLoader.js'

const { t } = useI18n()

const defaultScript = `/** @typedef {{_id: string, email: string, name: {givenName: string, familyName: string}}} User */
/** @typedef {{_id: string, identifier: string, organisation: string}} Project */
/** @typedef {{amount: number}} Money */
/** @typedef {Object<number,{on: Date ; by: User}>} Log */
/** @typedef {{project: Project, balance: Money, total: Money, advance: Money, expenses: Money, lumpSums?: Money , advanceOverflow: boolean }} AddUp */

/** 
 * @param {{name: string, reference: number, owner: User, editor: User, project: Project, bookingRemark?: string, state: number, log: Log, createdAt: Date, updatedAt: Date, _id: string, addUp?: AddUp[]}} input
 * @returns {{url?: string, headers?: Object.<string,string>, method?: 'POST'| 'PUT'| 'PATCH', convertBodyToFormData?: boolean, pdfFormFieldName?: string, body?: Object.<string,any> }}
*/
function run(input) {
  return {}
}`

const headers: Header[] = [
  { text: 'labels.name', value: 'name' },
  { text: 'labels.isActive', value: 'isActive' },
  { text: 'labels.reportType', value: 'reportType' },
  { text: 'labels.onState', value: 'onState' },
  { text: 'labels.executionOrder', value: 'executionOrder' },
  { text: '', value: 'buttons', width: 80 }
]

const list = useTemplateRef('list')
async function loadFromServer() {
  if (list.value) {
    list.value.loadFromServer()
  }
}
defineExpose({ loadFromServer })

await APP_LOADER.loadData()
const APP_DATA = APP_LOADER.data

const getEmptyFilter = () => ({ name: { $regex: undefined, $options: 'i' } })
const filter = ref(getEmptyFilter())

const showFilter = ref({ name: false })

function clickFilter(header: keyof typeof showFilter.value, event?: MouseEvent) {
  event?.stopPropagation()
  if (showFilter.value[header]) {
    showFilter.value[header] = false
    filter.value[header] = getEmptyFilter()[header]
  } else {
    showFilter.value[header] = true
  }
}

const webhookToEdit: Ref<Webhook | undefined> = ref(undefined)
const _showForm = ref(false)

function showForm(webhook?: Webhook) {
  const hook = webhook ? webhook : ({} as Webhook)
  hook.script = hook.script ? hook.script : defaultScript
  webhookToEdit.value = hook
  _showForm.value = true
}
async function postWebhook(webhook: Webhook) {
  webhook.script = webhook.script === defaultScript ? undefined : webhook.script
  const result = await API.setter<Webhook>('admin/webhook', webhook)
  if (result.ok) {
    _showForm.value = false
    webhookToEdit.value = undefined
    loadFromServer()
  }
}
async function deleteWebhook(webhook: Webhook<string>) {
  const result = await API.deleter('admin/webhook', { _id: webhook._id })
  if (result) {
    loadFromServer()
  }
}
const schema = Object.assign({}, (await API.getter<{ [key: string]: VueformSchema }>('admin/webhook/form')).ok?.data, {
  buttons: {
    type: 'group',
    schema: {
      submit: { type: 'button', submits: true, buttonLabel: t('labels.save'), full: true, columns: { container: 6 } },
      reset: { type: 'button', resets: true, buttonLabel: t('labels.cancel'), columns: { container: 6 }, secondary: true }
    }
  },
  _id: { type: 'hidden', meta: true }
})
</script>

<style></style>
