<template>
  <v-select
    v-if="$root.currencies.length > 0"
    :options="$root.user.settings.lastCurrencies.concat($root.currencies)"
    :modelValue="modelValue"
    :placeholder="$t('labels.currency')"
    @update:modelValue="(v: Currency) => $emit('update:modelValue', v)"
    @option:selected="$root.setLastCurrency"
    :filter="filter"
    :disabled="disabled"
    style="min-width: 200px">
    <template #option="{ name, _id, symbol, flag }: Currency">
      <div class="row align-items-center">
        <div v-if="flag" class="col-auto px-1">
          <span class="fs-2">{{ flag }}</span>
        </div>
        <div class="col p-1 lh-1 text-truncate" :title="name[$i18n.locale as Locale]">
          <span>{{ _id }}</span
          ><br />
          <span class="text-secondary">
            <small>{{ name[$i18n.locale as Locale] }}</small>
          </span>
        </div>
        <div v-if="symbol" class="col-auto ms-auto ps-0">
          {{ symbol }}
        </div>
      </div>
    </template>
    <template #selected-option="{ name, _id, symbol, flag }: Currency">
      <div :title="name[$i18n.locale as Locale]">
        <span v-if="flag" class="me-1">{{ flag }}</span>
        <span>{{ _id }}</span>
        <span v-if="symbol" class="ms-1 text-secondary">{{ symbol }}</span>
      </div>
    </template>
    <template v-if="required" #search="{ attributes, events }">
      <input class="vs__search" :required="!modelValue" v-bind="attributes" v-on="events" />
    </template>
  </v-select>
</template>

<script lang="ts">
import { PropType, defineComponent } from 'vue'
import { Currency, Locale } from '../../../../common/types.js'

export default defineComponent({
  name: 'CurrencySelector',
  data() {
    return {}
  },
  components: {},
  props: {
    modelValue: { type: Object as PropType<Currency> },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false }
  },
  emits: ['update:modelValue'],
  methods: {
    filter(options: Currency[], search: string): Currency[] {
      return options.filter((option) => {
        const name = option.name[this.$i18n.locale as Locale].toLocaleLowerCase().indexOf(search.toLocaleLowerCase()) > -1
        if (name) {
          return name
        }
        const code = option._id.toLocaleLowerCase().indexOf(search.toLocaleLowerCase()) > -1
        return code
      })
    }
  }
})
</script>

<style></style>
