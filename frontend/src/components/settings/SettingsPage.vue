<template>
  <div class="container">
    <div class="row">
      <div class="col-auto">
        <div class="d-flex flex-column flex-shrink-0 p-3" style="width: 280px; height: 100%">
          <ul class="nav nav-pills flex-column">
            <li class="nav-item">
              <a href="#settings" class="nav-link active"> {{ $t('labels.settings') }} </a>
            </li>
            <li>
              <a href="#user" class="nav-link link-body-emphasis">{{ $t('labels.user') }} </a>
            </li>
            <li>
              <a href="#" class="nav-link link-body-emphasis"> Orders </a>
            </li>
            <li>
              <a href="#" class="nav-link link-body-emphasis"> Products </a>
            </li>
            <li>
              <a href="#" class="nav-link link-body-emphasis"> Customers </a>
            </li>
          </ul>
        </div>
      </div>
      <div v-if="$root.settings.version" class="col">
        <h1>{{ $t('headlines.settings') }}</h1>
        <div class="container mb-3">
          <h2 id="settings">{{ $t('labels.settings') }}</h2>
          <Vueform :schema="schema" ref="form$" :endpoint="false" @submit="(form$: any) => postSettings(form$.data)"></Vueform>
        </div>
        <div class="container mb-3">
          <h2 id="user">{{ $t('labels.user') }}</h2>
          <UserList></UserList>
        </div>
        <div class="container mb-3">
          <h2>{{ $t('labels.models') }}</h2>
          <ModelsForm></ModelsForm>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import UserList from './elements/UserList.vue'
import ModelsForm from './forms/ModelsForm.vue'
export default defineComponent({
  name: 'SettingsPage',
  components: { UserList, ModelsForm },
  props: [],
  data() {
    return {
      schema: {
        buttons: {
          type: 'group',
          schema: {
            submit: { type: 'button', submits: true, buttonLabel: this.$t('labels.save'), full: true, columns: { container: 6 } }
          }
        },
        _id: { type: 'hidden', meta: true }
      } as any
    }
  },
  methods: {
    async getSchema() {
      const result = (await this.$root.getter<any>('admin/settings/schema', { language: this.$i18n.locale })).ok as any
      if (result) {
        this.schema = Object.assign({}, result, this.schema)
      }
    }
  },
  async created() {
    this.getSchema()
    await this.$root.load()
  },
  async mounted() {
    console.log(new Date())
    await this.$root.load()

    if (this.$root.settings.version) {
      console.log('insert')
      ;(this.$refs.form$ as any).load(this.$root.settings)
    }
  }
})
</script>

<style></style>
