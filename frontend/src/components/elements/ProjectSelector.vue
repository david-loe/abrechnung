<template>
  <div :class="$root.organisations.length > 1 ? 'input-group' : ''">
    <select
      v-if="$root.organisations.length > 1"
      ref="organisationSelect"
      class="form-select"
      id="healthCareCostFormProject"
      v-model="$root.user.settings.organisation"
      @update:model-value="$root.pushUserSettings($root.user.settings)"
      :disabled="disabled">
      <option v-for="organisation of $root.organisations" :value="organisation" :key="organisation._id">
        {{ organisation.name }}
      </option>
    </select>

    <v-select
      v-if="$root.projects.length > 0"
      ref="projectSelect"
      :options="$root.user.settings.lastProjects.concat($root.projects)"
      :modelValue="modelValue"
      :placeholder="$t('labels.project')"
      @update:modelValue="(v: ProjectSimple) => $emit('update:modelValue', v)"
      @option:selected="$root.setLastProject"
      :filter="filter"
      :disabled="disabled"
      style="min-width: 160px">
      <template #option="{ identifier }">
        <span>{{ identifier }}</span>
      </template>
      <template #selected-option="{ identifier }">
        <span>{{ identifier }}</span>
      </template>
      <template v-if="required" #search="{ attributes, events }">
        <input class="vs__search" :required="!modelValue" v-bind="attributes" v-on="events" />
      </template>
    </v-select>
  </div>
</template>

<script lang="ts">
import { PropType, defineComponent } from 'vue'
import { ProjectSimple } from '../../../../common/types.js'

export default defineComponent({
  name: 'ProjectSelector',
  data() {
    return {}
  },
  components: {},
  props: {
    modelValue: { type: Object as PropType<ProjectSimple> },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false }
  },
  emits: ['update:modelValue'],
  methods: {
    filter(options: ProjectSimple[], search: string): ProjectSimple[] {
      return options.filter(
        (option) =>
          option.identifier.toLocaleLowerCase().indexOf(search.toLocaleLowerCase()) > -1 &&
          (!this.$root.user.settings.organisation || option.organisation === this.$root.user.settings.organisation._id)
      )
    }
  },
  mounted() {
    //TODO:proper styling
    console.log(this.$refs.organisationSelect as Element)
  }
})
</script>

<style></style>
