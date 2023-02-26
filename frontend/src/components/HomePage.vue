<template>
<div class="container">
  <h1>{{$t('headlines.home')}}</h1>
</div>
</template>

<script>
export default {
  name: 'HomePage',
  components: {},
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