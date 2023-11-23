<template>
  <form class="container" @submit.prevent="save">
    <div class="mb-3">
      <label for="modelSelect" class="form-label"> {{ $t('labels.model') }}<span class="text-danger">*</span> </label>
      <select class="form-select" v-model="model" id="modelSelect" @change="get" required>
        <option v-for="modelS of models" :value="modelS" :key="modelS.name">
          {{ $t('labels.' + modelS.name) }}
        </option>
      </select>
    </div>
    <template v-if="objects">
      <div class="mb-3">
        <label for="objectSelect" class="form-label"> {{ $t('labels.object') }}<span class="text-danger">*</span> </label>
        <select class="form-select" v-model="object" id="objectSelect">
          <option v-for="objectS of objects" :value="objectS" :key="objectS._id">
            {{ objectS.name ? (objectS.name[$i18n.locale] ? objectS.name[$i18n.locale] : objectS.name) : objectS }}
          </option>
        </select>
      </div>
    </template>
    <div class="mb-2">
      <button type="button" class="btn btn-primary" :disabled="!Boolean(model)" @click="object = {}">
        {{ $t('labels.new') }}
      </button>
    </div>
    <template v-if="object">
      <div class="mb-3">
        <label for="objectJSON" class="form-label">{{
          object.name ? (object.name[$i18n.locale] ? object.name[$i18n.locale] : object.name) : model
        }}</label>
        <textarea
          class="form-control"
          id="objectJSON"
          rows="10"
          :value="JSON.stringify(object, null, 2)"
          @input="event => object = JSON.parse((event as any).target.value)"></textarea>
      </div>
    </template>
    <div class="mb-2">
      <button type="submit" class="btn btn-primary me-2" :disabled="loading">
        <span v-if="loading" class="spinner-border spinner-border-sm"></span>
        {{ $t('labels.save') }}
      </button>
      <button type="button" class="btn btn-danger me-2" :disabled="loading || !Boolean(object) || !Boolean(object._id)" @click="deleteIt">
        <span v-if="loading" class="spinner-border spinner-border-sm"></span>
        {{ $t('labels.delete') }}
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
      models: [
        { name: 'country' },
        { name: 'currency' },
        { name: 'organisation', GET: 'admin/organisation' },
        { name: 'healthInsurance' },
        { name: 'settings' }
      ],
      model: null as { name: string; GET?: string } | null,
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
    async save() {
      this.loading = true
      if (this.model) {
        await this.$root.setter<any>('admin/' + this.model.name, this.object)
      }
      this.clear()
    },
    async get() {
      this.object = null
      this.objects = null
      if (this.model) {
        const res = (await this.$root.getter<any[]>(this.model.GET ? this.model.GET : this.model.name)).ok
        if (res) {
          if (res.data.length == 1) {
            this.object = res.data[0]
          } else {
            this.objects = res.data
          }
        }
      }
    },
    async deleteIt() {
      this.loading = true
      if (this.object || this.object._id) {
        await this.$root.deleter('admin/' + this.model, { id: this.object._id })
      }
      this.clear()
    }
  }
})
</script>

<style></style>
