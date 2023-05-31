<template>
  <div>
    <StatePipeline class="mb-3" :state="travel.state"></StatePipeline>
    <table class="table">
      <tbody>
        <tr v-for="key of keys" :key="key">
          <template v-if="displayKey(key)">
            <th>{{ $t('labels.' + key) }}</th>
            <td>{{ displayKey(key) }}</td>
          </template>
        </tr>
        <tr>
          <th>{{ $t('labels.destinationPlace') }}</th>
          <td><PlaceElement :place="travel.destinationPlace"></PlaceElement></td>
        </tr>
      </tbody>
    </table>

    <div v-if="showButtons" class="mb-2">
      <button type="submit" class="btn btn-primary me-2" @click="$emit('edit')">
        {{ $t('labels.edit') }}
      </button>
      <button type="button" class="btn btn-danger me-2" @click="$emit('deleted')">
        {{ $t('labels.delete') }}
      </button>
      <button type="button" class="btn btn-light" @click="$emit('cancel')">
        {{ $t('labels.cancel') }}
      </button>
    </div>
  </div>
</template>

<script>
import StatePipeline from './StatePipeline.vue'
import PlaceElement from './PlaceElement.vue'
export default {
  name: 'TravelApply',
  data() {
    return {
      keys: ['traveler', 'reason', 'startDate', 'endDate', 'travelInsideOfEU', 'advance', 'editor', 'comment']
    }
  },
  components: {StatePipeline, PlaceElement},
  emits: ['cancel', 'edit', 'deleted'],
  props: {
    travel: { type: Object },
    showButtons: {type: Boolean, default: true}
  },
  methods: {
    displayKey(key) {
      switch (key) {
        case 'startDate':
        case 'endDate':
          return this.$root.datetoDateString(this.travel[key])
        case 'advance':
          return this.travel[key].amount + (this.travel[key].currency.symbol ? this.travel[key].currency.symbol + ' (' + this.travel[key].currency._id + ')' : ' ' + this.travel[key].currency._id)
        case 'state':
          return this.$t('states.' + this.travel[key])
        case 'editor':
          if(this.travel.traveler._id == this.travel.editor._id){
            return ''
          }
          return this.travel[key].name
        case 'traveler':
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