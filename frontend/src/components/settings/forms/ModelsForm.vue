<template>
  <form class="container" @submit.prevent="save">
    <div class="mb-3">
      <label for="modelSelect" class="form-label"> {{ $t('labels.model') }}<span class="text-danger">*</span> </label>
      <select class="form-select" v-model="model" id="modelSelect" @change="get" required>
        <option v-for="modelS of models" :value="modelS" :key="modelS">
          {{ $t('labels.' + modelS) }}
        </option>
      </select>
    </div>
    <template v-if="objects">
      <div class="mb-3">
        <label for="objectSelect" class="form-label"> {{ $t('labels.model') }}<span class="text-danger">*</span> </label>
        <select class="form-select" v-model="object" id="objectSelect" required>
          <option v-for="objectS of objects" :value="objectS" :key="objectS._id">
            {{ objectS.name ? (objectS.name[$i18n.locale] ? objectS.name[$i18n.locale] : objectS.name) : objectS }}
          </option>
        </select>
      </div>
    </template>
    <template v-if="object">
      <div class="mb-3">
        <label for="objectJSON" class="form-label">{{
          object.name ? (object.name[$i18n.locale] ? object.name[$i18n.locale] : object.name) : object
        }}</label>
        <textarea
          class="form-control"
          id="objectJSON"
          rows="3"
          :value="JSON.stringify(object, null, 2)"
          @input="event => object = JSON.parse((event as any).target.value)"></textarea>
      </div>
    </template>
    <div class="mb-2">
      <button type="submit" class="btn btn-primary me-2" :disabled="loading">
        <span v-if="loading" class="spinner-border spinner-border-sm"></span>
        {{ $t('labels.save') }}
      </button>
      <button type="button" class="btn btn-light" @click="clear">
        {{ $t('labels.cancel') }}
      </button>
    </div>
  </form>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  components: {},
  name: 'ModelsForm',
  props: {
    disabled: { type: Boolean, default: false }
  },
  data() {
    return {
      loading: false,
      models: ['country', 'currency', 'organisation', 'healthInsurance', 'settings'],
      model: null as string | null,
      object: null as any | null,
      objects: null as any[] | null
    }
  },
  methods: {
    clear() {
      this.loading = false
      this.model = null
      this.object = null
      this.objects = null
    },
    save() {},
    async get() {
      this.object = null
      this.objects = null
      if (this.model) {
        const res = (await this.$root.getter(this.model)).data
        if (Array.isArray(res)) {
          this.objects = res
        } else {
          this.object = res
        }
      }
    }
  }
})
</script>

<style></style>
