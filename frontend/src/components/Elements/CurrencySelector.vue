<template>
  <v-select
    :options="$root.currencies"
    :modelValue="modelValue"
    @update:modelValue="(v) => $emit('update:modelValue', v)"
    :filter="filter"
    :reduce="(cur) => cur._id"
    style="min-width: 250px;"
  >
    <template #option="{ name, _id, symbol, flag }">
      <div class="row align-items-center">
        <div v-if="flag" class="col-auto px-1">
          <span class="fs-2">{{ flag }}</span>
        </div>
        <div class="col-auto p-1 lh-1 text-truncate">
          <span>{{ _id }}</span><br />
          <span class="text-secondary">
            <small>{{ name[$root.user.settings.language] }}</small>
          </span>
        </div>
        <div v-if="symbol" class="col-auto ms-auto ps-0">
          {{ symbol }}
        </div>
      </div>
    </template>
    <template #selected-option="{ _id, symbol, flag }">
      <span v-if="flag" class="me-1">{{ flag }}</span>
      <span>{{ _id }}</span>
      <span v-if="symbol" class="ms-1 text-secondary">{{ symbol }}</span>
    </template>
    <template v-if="required" #search="{ attributes, events }">
      <input class="vs__search" :required="!modelValue" v-bind="attributes" v-on="events" />
    </template>
  </v-select>
</template>

<script>
export default {
  name: 'CurrencySelector',
  data() {
    return {}
  },
  components: {},
  props: ['modelValue', 'required'],
  emits: ['update:modelValue'],
  methods: {
    filter(options, search) {
      return options.filter((option) => {
        const name = option.name[this.$root.user.settings.language].toLocaleLowerCase().indexOf(search.toLocaleLowerCase()) > -1
        if (name) {
          return name
        }
        const code = option._id.toLocaleLowerCase().indexOf(search.toLocaleLowerCase()) > -1
        return code
      })
    },
  },
}
</script>

<style>
</style>