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
                        <input type="text" class="form-control" :placeholder="$t('labels.name')" v-model="searchFilter.name" />
                        <button class="btn btn-outline-secondary" type="submit"><i class="bi bi-search"></i></button>
                      </div>
                    </div>
                    <div class="col-auto">
                      <UserSelector v-model="searchFilter.owner" @update:model-value="getData(meta.page)"></UserSelector>
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
import UserSelector from './UserSelector.vue'
import { Base64 } from '../../../../common/scripts.js'

export default defineComponent({
  name: 'PaginationList',
  components: { UserSelector },
  data() {
    return {
      hasData: false,
      hasMeta: false,
      data: [] as any[],
      meta: { countPages: -1, page: -1 },
      search: false,
      searchFilter: this.default()
    }
  },
  props: {
    endpoint: { type: String, required: true },
    params: {type: Object, default: () => {return{filter: {}}}},
    showSearch: { type: Boolean, default: false }
  },
  methods: {
    default() {
      return {
        name: undefined as string | undefined,
        owner: undefined as string | undefined
      }
    },
    async getData(page?: number): Promise<void> {
      if (page === 0 || page) {
        if (page < 1) {
          page = 1
        } else if (this.hasMeta && page > this.meta.countPages) {
          page = this.meta.countPages
        }
      } else if (this.hasMeta) {
        page = this.meta.page
      }
      const queryParams: any = structuredClone(this.params)
      console.log(queryParams)
      Object.assign(queryParams.filter, this.searchFilter)
      const filterJSON = Base64.encode(JSON.stringify(queryParams.filter))
      delete queryParams.filter
      queryParams.filterJSON = filterJSON !== 'e30=' ? filterJSON : undefined

      var result = (await this.$root.getter<any[]>(this.endpoint, Object.assign({}, queryParams, { page }))).ok
      if (result) {
        this.data = result.data
        this.hasData = true
        this.meta = result.meta
        this.hasMeta = true
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
