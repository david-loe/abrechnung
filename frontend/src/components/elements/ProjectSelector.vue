<template>
  <div :class="$root.organisations.length > 1 ? 'input-group' : ''">
    <select
      v-if="$root.organisations.length > 1"
      class="form-select col-3"
      id="healthCareCostFormProject"
      v-model="$root.user.settings.organisation"
      @update:model-value="changeOrganisation($root.user.settings.organisation!)"
      :disabled="disabled">
      <option v-for="organisation of $root.organisations" :value="organisation" :key="organisation._id">
        {{ organisation.name }}
      </option>
    </select>

    <v-select
      v-if="$root.user.settings.projects && $root.settings.userCanSeeAllProjects === $root.projects.length > 0"
      :options="projects"
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
import { OrganisationSimple, Project, ProjectSimple } from '../../../../common/types.js'

export default defineComponent({
  name: 'ProjectSelector',
  data() {
    return {
      projects: [] as ProjectSimple[]
    }
  },
  components: {},
  props: {
    modelValue: { type: Object as PropType<ProjectSimple> },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false }
  },
  emits: ['update:modelValue'],
  methods: {
    changeOrganisation(newOrga: OrganisationSimple) {
      this.getProjects(newOrga._id)
      this.$root.pushUserSettings(this.$root.user.settings)
    },
    getProjects(orgaId?: string) {
      const projects: ProjectSimple[] = []
      for (const project of this.$root.user.settings.projects) {
        if (!orgaId || project.organisation === orgaId) {
          projects.push(project)
        }
      }

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
            if (!orgaId || project.organisation === orgaId) {
              projects.push(project)
            }
          }
        }
      }
      this.projects = projects
    },
    filter(options: (ProjectSimple | Project)[], search: string): ProjectSimple[] {
      return options.filter((option) => {
        return (
          option.identifier.toLowerCase().indexOf(search.toLowerCase()) > -1 ||
          ((option as Project).name && (option as Project).name!.toLowerCase().indexOf(search.toLowerCase()) > -1)
        )
      })
    }
  },
  beforeMount() {
    this.getProjects(this.$root.user.settings.organisation?._id)
  }
})
</script>

<style></style>
