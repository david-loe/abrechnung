<template>
  <div v-if="APP_DATA">
    <EasyDataTable
      class="mb-3"
      :rows-items="[5, 15, 25]"
      :rows-per-page="5"
      sort-by="name"
      :items="APP_DATA.healthInsurances"
      :filter-options="[
        {
          field: 'name',
          criteria: filter.name,
          comparison: (value: HealthInsurance['name'], criteria: string): boolean =>
            value.toLowerCase().indexOf(criteria.toLowerCase()) !== -1
        },
        {
          field: 'email',
          criteria: filter.email,
          comparison: (value: HealthInsurance['email'], criteria: string): boolean =>
            value.toLowerCase().indexOf(criteria.toLowerCase()) !== -1
        }
      ]"
      :headers="[{ text: $t('labels.name'), value: 'name' }, { text: $t('labels.email'), value: 'email' }, { value: 'buttons' }]">
      <template #header-name="header">
        <div class="filter-column">
          {{ header.text }}
          <span style="cursor: pointer" @click="clickFilter('name')">
            <i v-if="_filter.name" class="bi bi-funnel-fill"></i>
            <i v-else class="bi bi-funnel"></i>
          </span>
          <div v-if="_filter.name">
            <input type="text" class="form-control" v-model="filter.name" />
          </div>
        </div>
      </template>
      <template #header-email="header">
        <div class="filter-column">
          {{ header.text }}
          <span style="cursor: pointer" @click="clickFilter('email')">
            <i v-if="_filter.email" class="bi bi-funnel-fill"></i>
            <i v-else class="bi bi-funnel"></i>
          </span>
          <div v-if="_filter.email">
            <input type="text" class="form-control" v-model="filter.email" />
          </div>
        </div>
      </template>

      <template #item-buttons="healthInsurance">
        <button type="button" class="btn btn-light" @click="showForm('edit', healthInsurance)">
          <div class="d-none d-md-block">
            <i class="bi bi-pencil"></i>
          </div>
          <i class="bi bi-pencil d-block d-md-none"></i>
        </button>
        <button type="button" class="btn btn-danger ms-2" @click="deleteHealthInsurance(healthInsurance)">
          <div class="d-none d-md-block">
            <i class="bi bi-trash"></i>
          </div>
          <i class="bi bi-trash d-block d-md-none"></i>
        </button>
      </template>
    </EasyDataTable>
    <div v-if="_showForm" class="container" style="max-width: 650px">
      <Vueform
        :schema="schema"
        v-model="healthInsuranceToEdit"
        :sync="true"
        :endpoint="false"
        @submit="(form$: any) => postHealthInsurance(form$.data)"
        @reset="_showForm = false"></Vueform>
    </div>
    <button v-else type="button" class="btn btn-secondary" @click="showForm('add')">
      {{ $t('labels.addX', { X: $t('labels.healthInsurance') }) }}
    </button>
  </div>
</template>

<script lang="ts">
import API from '@/api.js'
import APP_LOADER from '@/appData.js'
import { defineComponent } from 'vue'
import { getById } from '../../../../../common/scripts.js'
import { HealthInsurance, accesses } from '../../../../../common/types.js'

interface Filter<T> {
  name: T
  email: T
}
export default defineComponent({
  name: 'HealthInsuranceList',
  components: {},
  data() {
    return {
      healthInsuranceToEdit: undefined as HealthInsurance | undefined,
      healthInsuranceFormMode: 'add' as 'add' | 'edit',
      _showForm: false,
      filter: {
        name: '',
        email: ''
      } as Filter<string>,
      _filter: {
        name: false,
        email: false
      } as Filter<boolean>,
      accesses,
      APP_DATA: APP_LOADER.data,
      schema: {}
    }
  },
  methods: {
    showForm(mode: 'add' | 'edit', healthInsurance?: HealthInsurance) {
      this.healthInsuranceFormMode = mode
      this.healthInsuranceToEdit = healthInsurance
      this._showForm = true
    },
    async postHealthInsurance(healthInsurance: HealthInsurance) {
      const result = await API.setter<HealthInsurance>('admin/healthInsurance', healthInsurance)
      if (result.ok) {
        await this.updateRoot()
        this._showForm = false
      }
      this.healthInsuranceToEdit = undefined
    },
    async deleteHealthInsurance(healthInsurance: HealthInsurance) {
      const result = await API.deleter('admin/healthInsurance', { _id: healthInsurance._id })
      if (result) {
        await this.updateRoot()
      }
    },
    async updateRoot() {
      const rootHealthInsurances = (await API.getter<HealthInsurance[]>('healthInsurance')).ok?.data
      if (rootHealthInsurances && this.APP_DATA) {
        this.APP_DATA.healthInsurances = rootHealthInsurances
      }
    },
    clickFilter(header: keyof Filter<string>) {
      if (this._filter[header]) {
        this._filter[header] = false
        this.filter[header] = ''
      } else {
        this._filter[header] = true
      }
    },
    getById
  },
  async created() {
    await APP_LOADER.loadData()
    this.schema = Object.assign({}, (await API.getter<any>('admin/healthInsurance/form')).ok?.data, {
      buttons: {
        type: 'group',
        schema: {
          submit: { type: 'button', submits: true, buttonLabel: this.$t('labels.save'), full: true, columns: { container: 6 } },
          reset: { type: 'button', resets: true, buttonLabel: this.$t('labels.cancel'), columns: { container: 6 }, secondary: true }
        }
      },
      _id: { type: 'hidden', meta: true }
    })
  }
})
</script>

<style></style>
