<template>
  <div :class="$root.organisations.length > 1 ? 'input-group' : ''">
    <select
      v-if="$root.organisations.length > 1"
      class="form-select col-3"
      id="healthCareCostFormProject"
      v-model="$root.user.settings.organisation"
      @update:model-value="$root.pushUserSettings($root.user.settings)"
      :disabled="disabled">
      <option v-for="organisation of $root.organisations" :value="organisation" :key="organisation._id">
        {{ organisation.name }}
      </option>
    </select>

    <v-select
      v-if="$root.user.settings.projects && $root.settings.userCanSeeAllProjects === $root.projects.length > 0"
      :options="getProjects()"
      :modelValue="modelValue"
      :placeholder="$t('labels.project')"
      @update:modelValue="(v: ProjectSimple) => $emit('update:modelValue', v)"
      :filter="filter"
      :disabled="disabled"
      :class="$root.organisations.length > 1 ? 'col-9' : ''">
      <template #option="{ identifier, name }: Project">
        <span>{{ identifier + (name ? ' ' + name : '') }}</span>
      </template>
      <template #selected-option="{ identifier, name }: Project">
        <span>{{ identifier + (name ? ' ' + name : '') }}</span>
      </template>
      <template v-if="required" #search="{ attributes, events }">
        <input class="vs__search" :required="!modelValue" v-bind="attributes" v-on="events" />
      </template>
    </v-select>
  </div>
</template>

<script lang="ts">
import { PropType, defineComponent } from 'vue'
import { Project, ProjectSimple } from '../../../../common/types.js'

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
    getProjects() {
      const projects: ProjectSimple[] = [...this.$root.user.settings.projects]
      if (this.$root.settings.userCanSeeAllProjects) {
        for (const project of this.$root.projects) {
          let alreadyIn = false
          for (const userProject of this.$root.user.settings.projects) {
            if (project._id === userProject._id) {
              alreadyIn = true
              break
            }
          }
          if (!alreadyIn) {
            projects.push(project)
          }
        }
      }
      return projects
    },
    filter(options: (ProjectSimple | Project)[], search: string): ProjectSimple[] {
      return options.filter((option) => {
        if (this.$root.user.settings.organisation && option.organisation !== this.$root.user.settings.organisation._id) {
          return false
        }
        return (
          option.identifier.toLowerCase().indexOf(search.toLowerCase()) > -1 ||
          ((option as Project).name && (option as Project).name!.toLowerCase().indexOf(search.toLowerCase()) > -1)
        )
      })
    }
  }
})
</script>

<style></style>
