<template>
  <div>
    <EasyDataTable
      class="mb-3"
      :rows-items="[5, 15, 25]"
      :rows-per-page="5"
      sort-by="name"
      :items="$root.currencies"
      :filter-options="[
        {
          field: 'name',
          criteria: filter.name,
          comparison: (value: Currency['name'], criteria: string): boolean => value[$i18n.locale as Locale].toLowerCase().indexOf(criteria.toLowerCase()) !== -1
        },
        {
          field: '_id',
          criteria: filter._id,
          comparison: (value: Currency['_id'], criteria: string): boolean => value.toLowerCase().indexOf(criteria.toLowerCase()) !== -1
        }
      ]"
      :headers="[
        { text: $t('labels.name'), value: 'name' },
        { text: $t('labels.code'), value: '_id' },
        { text: $t('labels.symbol'), value: 'symbol' },
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
      <template #header-_id="header">
        <div class="filter-column">
          {{ header.text }}
          <span style="cursor: pointer" @click="clickFilter('_id')">
            <i v-if="_filter._id" class="bi bi-funnel-fill"></i>
            <i v-else class="bi bi-funnel"></i>
          </span>
          <div v-if="_filter._id">
            <input type="text" class="form-control" v-model="filter._id" />
          </div>
        </div>
      </template>
      <template #item-name="{ name }">
        {{ name[$i18n.locale] }}
      </template>
      <template #item-buttons="currency">
        <button type="button" class="btn btn-light" @click="showForm('edit', currency)">
          <div class="d-none d-md-block">
            <i class="bi bi-pencil"></i>
          </div>
          <i class="bi bi-pencil d-block d-md-none"></i>
        </button>
        <button type="button" class="btn btn-danger ms-2" @click="deleteCurrency(currency)">
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
        v-model="currencyToEdit"
        :sync="true"
        :endpoint="false"
        @submit="(form$: any) => postCurrency(form$.data)"
        @reset="_showForm = false"></Vueform>
    </div>
    <button v-else type="button" class="btn btn-secondary" @click="showForm('add')">
      {{ $t('labels.addX', { X: $t('labels.currency') }) }}
    </button>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import currencyFormSchema from '../../../../../common/forms/currency.json'
import { Currency, Locale, accesses } from '../../../../../common/types.js'

interface Filter<T> {
  name: T
  _id: T
}
export default defineComponent({
  name: 'CurrencyList',
  components: {},
  data() {
    return {
      currencyToEdit: undefined as Currency | undefined,
      currencyFormMode: 'add' as 'add' | 'edit',
      _showForm: false,
      filter: {
        name: '',
        _id: ''
      } as Filter<string>,
      _filter: {
        name: false,
        _id: false
      } as Filter<boolean>,
      accesses,
      schema: Object.assign({}, currencyFormSchema, {
        buttons: {
          type: 'group',
          schema: {
            submit: { type: 'button', submits: true, buttonLabel: this.$t('labels.save'), full: true, columns: { container: 6 } },
            reset: { type: 'button', resets: true, buttonLabel: this.$t('labels.cancel'), columns: { container: 6 }, secondary: true }
          }
        }
      })
    }
  },
  methods: {
    showForm(mode: 'add' | 'edit', currency?: Currency) {
      this.currencyFormMode = mode
      this.currencyToEdit = currency
      this._showForm = true
    },
    async postCurrency(currency: Currency) {
      console.log(currency)
      const result = await this.$root.setter<Currency>('admin/currency', currency)
      if (result.ok) {
        this._showForm = false
      }
      this.currencyToEdit = undefined
    },
    async deleteCurrency(currency: Currency) {
      const result = await this.$root.deleter('admin/currency', { _id: currency._id })
      if (result) {
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
  }
})
</script>

<style></style>
