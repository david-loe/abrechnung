<template>
  <div style="min-height: 120px">
    <template v-if="hasData">
      <template v-if="showSearch">
        <div v-if="!search" class="row justify-content-end mb-2">
          <div class="col-auto">
            <button type="button" class="btn btn-light" @click="search = true"><i class="bi bi-search"></i></button>
          </div>
        </div>
        <div v-else class="row mb-2">
          <div class="col">
            <div class="row justify-content-center align-items-center">
              <div class="col-auto">
                <form @submit.prevent="getData(meta.page)">
                  <div class="row">
                    <div class="col-auto">
                      <div class="input-group mb-3">
                        <input type="text" class="form-control" :placeholder="$t('labels.name')" v-model="searchFilter.name.$regex" />
                        <button class="btn btn-outline-secondary" type="submit"><i class="bi bi-search"></i></button>
                      </div>
                    </div>
                    <div class="col-auto">
                      <UserSelector
                        v-model="searchFilter.owner"
                        @update:model-value="getData(meta.page)"
                        :placeholder="$t('labels.owner')"></UserSelector>
                    </div>
                    <div class="col-auto">
                      <ProjectSelector
                        v-model="searchFilter.project"
                        @update:model-value="getData(meta.page)"
                        :org-select-split="5"
                        style="min-width: 184px"></ProjectSelector>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div class="col-auto ms-auto">
            <button type="button" class="btn btn-light" @click="clearSearch()"><i class="bi bi-x-lg"></i></button>
          </div>
        </div>
      </template>

      <div class="row justify-content-center gx-4 gy-2">
        <div class="col-auto" v-for="entry of data" :key="entry._id">
          <slot name="entry" :entry="entry"></slot>
        </div>
      </div>
      <div v-if="data.length === 0" class="alert alert-light" role="alert">
        {{ $t('alerts.noData.' + endpoint) }}
      </div>
      <div v-else-if="meta && meta.countPages > 1" class="mx-auto text-secondary" style="width: fit-content">
        <span class="me-2 p-2" style="cursor: pointer" @click="getData(meta.page - 1)">&lt;</span>
        <span
          v-for="x of meta.countPages"
          :class="'me-2 p-2' + (meta.page == x ? ' fs-5' : '')"
          :key="x"
          :style="meta.page == x ? '' : 'cursor: pointer;'"
          @click="meta.page == x ? null : getData(x)">
          {{ x }}
        </span>
        <span class="p-2" style="cursor: pointer" @click="getData(meta.page + 1)">&gt;</span>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { Base64 } from '../../../../common/scripts.js'
import ProjectSelector from './ProjectSelector.vue'
import UserSelector from './UserSelector.vue'

export default defineComponent({
  name: 'PaginationList',
  components: { UserSelector, ProjectSelector },
  data() {
    return {
      hasData: false,
      hasMeta: false,
      data: [] as any[],
      meta: { countPages: -1, page: -1, limit: 12 },
      search: false,
      searchFilter: this.default()
    }
  },
  props: {
    endpoint: { type: String, required: true },
    params: {
      type: Object,
      default: () => {
        return { filter: {} }
      }
    },
    showSearch: { type: Boolean, default: false }
  },
  methods: {
    default() {
      return {
        name: { $regex: undefined as string | undefined, $options: 'i' },
        owner: undefined as string | undefined,
        project: undefined as string | undefined
      }
    },
    async getData(page?: number): Promise<void> {
      if (page === 0 || page) {
        if (page < 1) {
          page = 1
        } else if (this.hasMeta && page > this.meta.countPages && this.meta.countPages > 0) {
          page = this.meta.countPages
        }
      } else if (this.hasMeta) {
        page = this.meta.page
      }
      const queryParams: any = structuredClone(this.params)
      Object.assign(queryParams.filter, this.searchFilter)
      for (const filterKey in queryParams.filter) {
        if (queryParams.filter[filterKey] === null || queryParams.filter[filterKey] === undefined) {
          delete queryParams.filter[filterKey]
        } else if (!queryParams.filter[filterKey].$regex && queryParams.filter[filterKey].$options) {
          delete queryParams.filter[filterKey]
        }
      }

      const filterJSON = Base64.encode(JSON.stringify(queryParams.filter))
      delete queryParams.filter
      queryParams.filterJSON = filterJSON !== 'e30=' ? filterJSON : undefined

      let result = (await this.$root.getter<any[]>(this.endpoint, Object.assign({}, queryParams, { page, limit: this.meta.limit }))).ok
      if (result) {
        this.data = result.data
        this.hasData = true
        this.meta = result.meta
        this.hasMeta = true
      }
      if (navigator.onLine) {
        this.getRoutesForStore()
      }
    },
    getRoutesForStore() {
      fetch('/backend/' + this.endpoint + '/examiner')
      if (this.hasData) {
        for (let i = 0; i < this.data.length; i++) {
          fetch(
            '/backend/' +
              this.endpoint +
              '?_id=' +
              this.data[i]._id +
              (this.endpoint == 'travel'
                ? '&additionalFields=stages&additionalFields=expenses&additionalFields=days'
                : '&additionalFields=expenses')
          )
        }
      }
    },
    clearSearch() {
      this.searchFilter = this.default()
      this.search = false
      this.getData(this.meta.page)
    }
  },
  async created() {
    await this.getData()
  }
})
</script>

<style></style>
