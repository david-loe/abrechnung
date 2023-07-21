<template>
  <div class="container">
    <h1>{{ $t('headlines.settings') }}</h1>
    <div class="container mb-3">
      <h2>{{ $t('labels.user') }}</h2>
      <UserList></UserList>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import UserList from './Settings/UserList.vue'
export default defineComponent({
  name: 'SettingsPage',
  components: { UserList },
  props: [],
  data() {
    return {}
  },
  methods: {},
  async beforeMount() {
    await this.$root.load()
  }
})
</script>

<style></style>
