<template>
<div class="container">
  <h1>{{$t('headlines.approve')}}</h1>
</div>
</template>

<script>
export default {
  name: 'ApprovePage',
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