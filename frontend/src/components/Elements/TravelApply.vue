<template>
  <div>
    <table class="table">
      <tbody>
        <tr v-for="key in keys" :key="key">
          <template v-if="displayKey(key)">
            <th>{{ $t('labels.' + key) }}</th>
            <td>{{ displayKey(key) }}</td>
          </template>
        </tr>
      </tbody>
    </table>

    <div v-if="showButtons" class="mb-2">
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
      keys: ['traveler', 'reason', 'startDate', 'endDate', 'destinationPlace', 'travelInsideOfEU', 'advance', 'state', 'editor', 'comment']
    }
  },
  components: {},
  emits: ['cancel', 'edit'],
  props: {
    travel: { type: Object },
    showButtons: {type: Boolean, default: true}
  },
  methods: {
    displayKey(key) {
      switch (key) {
        case 'startDate':
        case 'endDate':
          return new Date(this.travel[key]).toLocaleDateString()
        case 'advance':
          return this.travel[key].amount + ' ' + this.travel[key].currency._id
        case 'state':
          return this.$t('states.' + this.travel[key])
        case 'editor':
          if(this.travel.traveler._id == this.travel.editor._id){
            return ''
          }
        case 'traveler': //eslint-disable-line no-fallthrough
          if(this.travel.traveler._id == this.$root.user._id){
            return ''
          }
          return this.travel[key].name
        default:
          if (typeof this.travel[key] == 'boolean') {
            if (this.travel[key]) {
              return '✅'
            } else {
              return '❌'
            }
          }
          return this.travel[key]
      }
    },
  },
  mounted() {},
}
</script>

<style>
</style>