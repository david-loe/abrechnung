<template>
  <div>
    <table class="table">
      <tbody>
        <tr v-for="key in keys" :key="key">
          <th>{{ $t('labels.' + key) }}</th>
          <td>{{ displayKey(key) }}</td>
        </tr>
      </tbody>
    </table>

    <div class="mb-2">
      <button type="submit" class="btn btn-primary me-2" @click="$emit('edit')">
        {{ $t('labels.edit') }}
      </button>
      <button type="button" class="btn btn-light" @click="$emit('cancel')">
        {{ $t('labels.cancel') }}
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'TravelApply',
  data() {
    return {
      keys: ['name', 'reason', 'startDate', 'endDate', 'destinationPlace', 'travelInsideOfEU', 'advance', 'state']
    }
  },
  components: {},
  emits: ['cancel', 'edit'],
  props: {
    travel: { type: Object },
  },
  methods: {
    displayKey(key) {
      switch (key) {
        case 'startDate':
        case 'endDate':
          return (new Date(this.travel[key])).toLocaleDateString()
        case 'advance':
          return this.travel[key].amount + ' ' + this.travel[key].currency._id
        case 'state':
          return this.$t('states.' + this.travel[key])
        default:
          if(typeof this.travel[key] == 'boolean'){
            if(this.travel[key]){
              return '✅'
            }else{
              return '❌'
            }
          }
          return this.travel[key];
      }
    }
  },
  mounted() {},
}
</script>

<style>
</style>