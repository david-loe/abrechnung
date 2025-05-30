<template>
  <div>
    <ListElement class="mb-3" ref="list" endpoint="admin/ledgerAccount" :filter="filter" :headers="headers">
      <template #header-identifier="header">
        <div class="filter-column">
          {{ header.text }}
          <span style="cursor: pointer" @click="clickFilter('identifier')">
            <i v-if="showFilter.identifier" class="bi bi-funnel-fill"></i>
            <i v-else class="bi bi-funnel"></i>
          </span>
          <div v-if="showFilter.identifier">
            <input type="text" class="form-control" v-model="(filter.identifier as any).$regex" />
          </div>
        </div>
      </template>
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

      <template #item-buttons="ledgerAccount">
        <button type="button" class="btn btn-light btn-sm" @click="showForm(ledgerAccount)">
          <div class="d-none d-md-block">
            <i class="bi bi-pencil"></i>
          </div>
          <i class="bi bi-pencil d-block d-md-none"></i>
        </button>
        <button type="button" class="btn btn-danger btn-sm ms-2" @click="deleteLedgerAccount(ledgerAccount)">
          <div class="d-none d-md-block">
            <i class="bi bi-trash"></i>
          </div>
          <i class="bi bi-trash d-block d-md-none"></i>
        </button>
      </template>
    </ListElement>
    <div v-if="_showForm" class="container">
      <Vueform
        :schema="schema"
        v-model="ledgerAccountToEdit"
        :sync="true"
        :endpoint="false"
        @submit="(form$: any) => postLedgerAccount(form$.data)"
        @reset="_showForm = false"></Vueform>
    </div>
    <button v-else type="button" class="btn btn-secondary" @click="showForm()">
      {{ $t('labels.addX', { X: $t('labels.ledgerAccount') }) }}
    </button>
  </div>
</template>

<script lang="ts" setup>
import { LedgerAccount } from '@/../../common/types.js'
import API from '@/api.js'
import APP_LOADER from '@/appData.js'
import ListElement from '@/components/elements/ListElement.vue'
import { Ref, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Header } from 'vue3-easy-data-table'

const { t } = useI18n()

const headers: Header[] = [
  { text: t('labels.identifier'), value: 'identifier' },
  { text: t('labels.name'), value: 'name' },
  { text: '', value: 'buttons', width: 80 }
]

const list = useTemplateRef('list')
async function loadFromServer() {
  if (list.value) {
    list.value.loadFromServer()
  }
}
defineExpose({ loadFromServer })

const getEmptyFilter = () => ({ name: { $regex: undefined, $options: 'i' }, identifier: { $regex: undefined, $options: 'i' } })

const filter = ref(getEmptyFilter())

const showFilter = ref({
  name: false,
  identifier: false
})

function clickFilter(header: keyof typeof showFilter.value) {
  if (showFilter.value[header]) {
    showFilter.value[header] = false
    filter.value[header] = getEmptyFilter()[header]
  } else {
    showFilter.value[header] = true
  }
}

const ledgerAccountToEdit: Ref<LedgerAccount | undefined> = ref(undefined)
const _showForm = ref(false)

function showForm(ledgerAccount?: LedgerAccount) {
  ledgerAccountToEdit.value = ledgerAccount
  _showForm.value = true
}
async function postLedgerAccount(ledgerAccount: LedgerAccount) {
  const result = await API.setter<LedgerAccount>('admin/ledgerAccount', ledgerAccount)
  if (result.ok) {
    _showForm.value = false
    loadFromServer()
    APP_LOADER.loadOptional('admin/ledgerAccount')
  }
  ledgerAccountToEdit.value = undefined
}
async function deleteLedgerAccount(ledgerAccount: LedgerAccount) {
  const result = await API.deleter('admin/ledgerAccount', { _id: ledgerAccount._id })
  if (result) {
    loadFromServer()
    APP_LOADER.loadOptional('admin/ledgerAccount')
  }
}

const schema = Object.assign({}, (await API.getter<any>('admin/ledgerAccount/form')).ok?.data, {
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
