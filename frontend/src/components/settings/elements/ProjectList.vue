<template>
  <div>
    <EasyDataTable
      class="mb-3"
      :rows-items="[5, 15, 25]"
      :rows-per-page="5"
      sort-by="name"
      :items="projects"
      :filter-options="[
        {
          field: 'identifier',
          criteria: filter.identifier,
          comparison: (value: Project['identifier'], criteria: string): boolean =>
            value.toLowerCase().indexOf(criteria.toLowerCase()) !== -1
        },
        {
          field: 'name',
          criteria: filter.name,
          comparison: (value: Project['name'], criteria: string): boolean =>
            (!Boolean(value) && !Boolean(criteria)) || value!.toLowerCase().indexOf(criteria.toLowerCase()) !== -1
        }
      ]"
      :headers="[
        { text: $t('labels.identifier'), value: 'identifier' },
        { text: $t('labels.name'), value: 'name' },
        { text: $t('labels.organisation'), value: 'organisation', sortable: true },
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
      <template #header-identifier="header">
        <div class="filter-column">
          {{ header.text }}
          <span style="cursor: pointer" @click="clickFilter('identifier')">
            <i v-if="_filter.identifier" class="bi bi-funnel-fill"></i>
            <i v-else class="bi bi-funnel"></i>
          </span>
          <div v-if="_filter.identifier">
            <input type="text" class="form-control" v-model="filter.identifier" />
          </div>
        </div>
      </template>
      <template #item-organisation="{ organisation }">
        {{ getById(organisation, $root.organisations)?.name }}
      </template>
      <template #item-buttons="project">
        <button type="button" class="btn btn-light" @click="showForm('edit', project)">
          <div class="d-none d-md-block">
            <i class="bi bi-pencil"></i>
          </div>
          <i class="bi bi-pencil d-block d-md-none"></i>
        </button>
        <button type="button" class="btn btn-danger ms-2" @click="deleteProject(project)">
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
        v-model="projectToEdit"
        :sync="true"
        :endpoint="false"
        @submit="(form$: any) => postProject(form$.data)"
        @reset="_showForm = false"></Vueform>
    </div>
    <button v-else type="button" class="btn btn-secondary" @click="showForm('add')">
      {{ $t('labels.addX', { X: $t('labels.project') }) }}
    </button>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import projectFormSchema from '../../../../../common/forms/project.json'
import { getById } from '../../../../../common/scripts.js'
import { OrganisationSimple, Project, accesses } from '../../../../../common/types.js'

interface Filter<T> {
  name: T
  identifier: T
}
export default defineComponent({
  name: 'ProjectList',
  components: {},
  data() {
    return {
      projects: [] as Project[],
      projectToEdit: undefined as Project | undefined,
      projectFormMode: 'add' as 'add' | 'edit',
      _showForm: false,
      filter: {
        name: '',
        identifier: ''
      } as Filter<string>,
      _filter: {
        name: false,
        identifier: false
      } as Filter<boolean>,
      accesses,
      schema: Object.assign({}, projectFormSchema, {
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
    showForm(mode: 'add' | 'edit', project?: Project) {
      this.projectFormMode = mode
      this.projectToEdit = project
      this._showForm = true
    },
    async postProject(project: Project) {
      const result = await this.$root.setter<Project>('admin/project', project)
      if (result.ok) {
        this.getProjects()
        this._showForm = false
      }
      this.projectToEdit = undefined
    },
    async deleteProject(project: Project) {
      const result = await this.$root.deleter('admin/project', { _id: project._id })
      if (result) {
        this.getProjects()
      }
    },
    async getProjects() {
      const result = (await this.$root.getter<Project[]>('admin/project')).ok
      if (result) {
        this.projects = result.data
      }
      const rootProjects = (await this.$root.getter<Project[]>('project', {}, {}, false)).ok?.data
      if (rootProjects) {
        this.$root.projects = rootProjects
      }
    },
    clickFilter(header: keyof Filter<string>) {
      if (this._filter[header]) {
        this._filter[header] = false
        this.filter[header] = ''
      } else {
        this._filter[header] = true
      }
    },
    getById
  },
  async created() {
    await this.$root.load()
    this.getProjects()
  }
})
</script>

<style></style>
