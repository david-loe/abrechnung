<template>
  <div class="container">
    <h1>{{ $t('headlines.settings') }}</h1>
  </div>
</template>

<script>

export default {
  name: 'SettingsPage',
  components: {
  },
  props: [],
  data() {
    return {}
  },
  methods: {},
  async beforeMount() {
    await this.$root.load()
  },
}
</script>

<style>
</style>