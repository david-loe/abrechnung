<template>
  <v-select
    v-if="APP_DATA"
    :options="APP_DATA.user.settings.lastCountries.concat(APP_DATA.countries)"
    :modelValue="modelValue"
    :placeholder="$t('labels.country')"
    @update:modelValue="(v: CountrySimple) => $emit('update:modelValue', v)"
    @option:selected="$root.setLastCountry"
    :filter="filter"
    :getOptionKey="(option: CountrySimple) => option._id"
    :getOptionLabel="(option: CountrySimple) => option.name[$i18n.locale as Locale]"
    :disabled="disabled"
    style="min-width: 160px">
    <template #option="{ name, flag }">
      <div class="row align-items-center" :title="name[$i18n.locale]">
        <div v-if="flag" class="col-auto px-1">
          <span class="fs-3">{{ flag }}</span>
        </div>
        <div class="col p-1 text-truncate">
          <small>{{ name[$i18n.locale] }}</small>
        </div>
      </div>
    </template>
    <template #selected-option="{ _id, name, flag }">
      <div :title="name[$i18n.locale]">
        <span v-if="flag" class="me-1">{{ flag }}</span>
        <span>{{ _id }}</span>
      </div>
    </template>
    <template v-if="required" #search="{ attributes, events }">
      <input class="vs__search" :required="!modelValue" v-bind="attributes" v-on="events" />
    </template>
  </v-select>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { CountrySimple, Locale } from '@/../../common/types.js'
import APP_LOADER from '@/appData.js'

export default defineComponent({
  name: 'CountrySelector',
  data() {
    return { APP_DATA: APP_LOADER.data }
  },
  components: {},
  props: {
    modelValue: { type: Object as PropType<CountrySimple> },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false }
  },
  emits: ['update:modelValue'],
  methods: {
    filter(options: CountrySimple[], search: string): CountrySimple[] {
      return options.filter((option) => {
        const currentLocale = this.$i18n.locale as Locale
        const name = option.name[currentLocale].toLowerCase().indexOf(search.toLowerCase()) > -1
        if (name) {
          return name
        }
        if (option.alias?.[currentLocale]) {
          for (const alias of option.alias[currentLocale]) {
            const result = alias.toLowerCase().indexOf(search.toLowerCase()) > -1
            if (result) {
              return result
            }
          }
        }

        const code = option._id.toLowerCase().indexOf(search.toLowerCase()) > -1
        return code
      })
    }
  },
  async created() {
    await APP_LOADER.loadData()
  }
})
</script>

<style></style>
