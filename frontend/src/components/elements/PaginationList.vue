<template>
  <div style="min-height: 120px">
    <template v-if="hasData">
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
export default defineComponent({
  name: 'PaginationList',
  data() {
    return {
      hasData: false,
      hasMeta: false,
      data: [] as any[],
      meta: { countPages: -1, page: -1 }
    }
  },
  props: {
    endpoint: { type: String, required: true }
  },
  methods: {
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
      var result = await this.$root.getter(this.endpoint, { page })
      this.data = result.data
      this.hasData = true
      this.meta = result.meta
      this.hasMeta = true
    }
  },
  async created() {
    await this.getData()
  }
})
</script>

<style></style>
