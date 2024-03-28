<template>
  <div class="container">
    <h1>{{ $t('headlines.settings') }}</h1>
    <div class="container mb-3">
      <h2>{{ $t('labels.user') }}</h2>
      <UserList></UserList>
    </div>
    <div class="container mb-3">
      <h2>{{ $t('labels.models') }}</h2>
      <ModelsForm></ModelsForm>
    </div>
    <Vueform>
      <TextElement name="hello_world" label="Hello" placeholder="World" />
    </Vueform>
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
    return {}
  },
  methods: {},
  async created() {
    await this.$root.load()
  }
})
</script>

<style></style>
