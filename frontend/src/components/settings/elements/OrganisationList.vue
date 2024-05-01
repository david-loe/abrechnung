<template>
  <div>
    <EasyDataTable
      class="mb-3"
      :rows-items="[5, 15, 25]"
      :rows-per-page="5"
      sort-by="name"
      :items="organisations"
      :filter-options="[
        {
          field: 'name',
          criteria: filter.name,
          comparison: (value: Organisation['name'], criteria: string): boolean => value.toLowerCase().indexOf(criteria.toLowerCase()) !== -1
        }
      ]"
      :headers="[
        { text: $t('labels.name'), value: 'name' },
        { text: $t('labels.subfolderPath'), value: 'subfolderPath' },
        { text: $t('labels.website'), value: 'website' },
        { value: 'buttons' }
      ]">
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
      <template #item-buttons="organisation">
        <button type="button" class="btn btn-light" @click="showForm(organisation)">
          <div class="d-none d-md-block">
            <i class="bi bi-pencil"></i>
          </div>
          <i class="bi bi-pencil d-block d-md-none"></i>
        </button>
        <button type="button" class="btn btn-danger ms-2" @click="deleteOrganisation(organisation)">
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
        v-model="organisationToEdit"
        :sync="true"
        :endpoint="false"
        @submit="(form$: any) => postOrganisation(form$.data)"
        @reset="_showForm = false"></Vueform>
    </div>
    <button v-else type="button" class="btn btn-secondary" @click="showForm()">
      {{ $t('labels.addX', { X: $t('labels.organisation') }) }}
    </button>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import organisationFormSchema from '../../../../../common/forms/organisation.json'
import { Organisation, accesses } from '../../../../../common/types.js'

interface Filter<T> {
  name: T
  email: T
}
export default defineComponent({
  name: 'OrganisationList',
  components: {},
  data() {
    return {
      organisations: [] as Organisation[],
      organisationToEdit: undefined as Organisation | undefined,
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
      schema: Object.assign({}, organisationFormSchema, {
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
  },
  methods: {
    showForm(organisation?: Organisation) {
      this.organisationToEdit = organisation
      this._showForm = true
    },
    async postOrganisation(organisation: Organisation) {
      var headers = {}
      if (organisation.logo && organisation.logo.data) {
        headers = {
          'Content-Type': 'multipart/form-data'
        }
      }
      const result = await this.$root.setter<Organisation>('admin/organisation', organisation, { headers })
      if (result.ok) {
        this.getOrganisations()
        this._showForm = false
      }
      this.organisationToEdit = undefined
    },
    async deleteOrganisation(organisation: Organisation) {
      const result = await this.$root.deleter('admin/organisation', { _id: organisation._id })
      if (result) {
        this.getOrganisations()
      }
    },
    async getOrganisations() {
      const result = (await this.$root.getter<Organisation[]>('admin/organisation')).ok
      if (result) {
        this.organisations = result.data
      }
      const rootOrganisations = (await this.$root.getter<Organisation[]>('organisation')).ok?.data
      if (rootOrganisations) {
        this.$root.organisations = rootOrganisations
      }
    },
    clickFilter(header: keyof Filter<string>) {
      if (this._filter[header]) {
        this._filter[header] = false
        this.filter[header] = ''
      } else {
        this._filter[header] = true
      }
    }
  },
  async created() {
    await this.$root.load()
    this.getOrganisations()
  }
})
</script>

<style></style>
