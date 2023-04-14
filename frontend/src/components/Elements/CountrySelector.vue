<template>
  <v-select v-if="$root.user.settings" :options="$root.countries" :modelValue="modelValue"
    @update:modelValue="(v) => $emit('update:modelValue', v)" :filter="filter" :reduce="(cur) => cur._id"
    style="min-width: 160px;">
    <template #option="{ name, flag }">
      <div class="row align-items-center" :title="name[$root.user.settings.language]">
        <div v-if="flag" class="col-auto px-1">
          <span class="fs-3">{{ flag }}</span>
        </div>
        <div class="col p-1 text-truncate">
          <small>{{ name[$root.user.settings.language] }}</small>
        </div>
      </div>
    </template>
    <template #selected-option="{ _id, name, flag }">
      <div :title="name[$root.user.settings.language]">
        <span v-if="flag" class="me-1">{{ flag }}</span>
        <span>{{ _id }}</span>
      </div>
    </template>
    <template v-if="required" #search="{ attributes, events }">
      <input class="vs__search" :required="!modelValue" v-bind="attributes" v-on="events" />
    </template>
  </v-select>
</template>

<script>
export default {
  name: 'CountrySelector',
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
        if (option.alias && option.alias[this.$root.user.settings.language]) {
          const alias = option.alias[this.$root.user.settings.language].toLocaleLowerCase().indexOf(search.toLocaleLowerCase()) > -1
          if (alias) {
            return alias
          }
        }

        const code = option._id.toLocaleLowerCase().indexOf(search.toLocaleLowerCase()) > -1
        return code
      })
    },
  },
}
</script>

<style></style>