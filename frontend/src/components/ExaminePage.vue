<template>
<div class="container">
  <h1>{{$t('labels.examine')}}</h1>
</div>
</template>

<script>
export default {
  name: 'ExaminePage',
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