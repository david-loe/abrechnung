<template>
  <div :class="APP_DATA && APP_DATA.organisations.length > 1 ? 'input-group' : ''">
    <select
      v-if="APP_DATA && APP_DATA.organisations.length > 1"
      :class="'form-select col-' + orgSelectSplit"
      id="healthCareCostFormProject"
      v-model="org"
      @update:model-value="changeOrganisation(org!)"
      :disabled="disabled">
      <option v-for="organisation of APP_DATA.organisations" :value="organisation" :key="organisation._id">
        {{ organisation.name }}
      </option>
    </select>

    <v-select
      v-if="projects"
      :options="projects"
      :modelValue="modelValue"
      :placeholder="$t('labels.project')"
      @update:modelValue="(v: ProjectSimple) => $emit('update:modelValue', v)"
      :filter="filter"
      :disabled="disabled"
      :class="APP_DATA && APP_DATA.organisations.length > 1 ? 'col-' + (12 - orgSelectSplit) : ''">
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
import APP_LOADER from '@/appData.js'
import { PropType, defineComponent } from 'vue'
import { OrganisationSimple, Project, ProjectSimple } from '../../../../common/types.js'

export default defineComponent({
  name: 'ProjectSelector',
  data() {
    return {
      projects: [] as ProjectSimple[],
      org: undefined as undefined | null | OrganisationSimple,
      APP_DATA: APP_LOADER.data
    }
  },
  components: {},
  props: {
    modelValue: { type: Object as PropType<ProjectSimple> },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    updateUserOrg: { type: Boolean, default: false },
    orgSelectSplit: { type: Number as PropType<3 | 4 | 5 | 6>, default: 3 }
  },
  emits: ['update:modelValue'],
  methods: {
    changeOrganisation(newOrga: OrganisationSimple) {
      this.getProjects(newOrga._id)
      if (this.updateUserOrg) {
        this.APP_DATA!.user.settings.organisation = newOrga
        this.$root.pushUserSettings(this.APP_DATA!.user.settings)
      }
    },
    getProjects(orgaId?: string) {
      const projects: ProjectSimple[] = []
      if (this.APP_DATA) {
        for (const project of this.APP_DATA.user.projects.assigned) {
          if (!orgaId || project.organisation === orgaId) {
            projects.push(project)
          }
        }
        if (this.APP_DATA.projects) {
          for (const project of this.APP_DATA.projects) {
            let alreadyIn = false
            for (const userProject of this.APP_DATA.user.projects.assigned) {
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
  async beforeMount() {
    this.APP_DATA = await APP_LOADER.loadData()
    if (this.updateUserOrg) {
      this.org = this.APP_DATA.user.settings.organisation
    }
    this.getProjects(this.org?._id)
  }
})
</script>

<style></style>
