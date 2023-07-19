<template>
  <div>
    <StatePipeline class="mb-3" :state="travel.state"></StatePipeline>
    <table class="table">
      <tbody>
        <tr v-for="key of keys" :key="key">
          <template v-if="displayKey(key as keyof TravelSimple)">
            <th>{{ $t('labels.' + key) }}</th>
            <td>{{ displayKey(key as keyof TravelSimple) }}</td>
          </template>
        </tr>
        <tr>
          <th>{{ $t('labels.destinationPlace') }}</th>
          <td>
            <PlaceElement :place="travel.destinationPlace"></PlaceElement>
          </td>
        </tr>
        <tr v-if="travel.advance.amount != null">
          <th>{{ $t('labels.advance') }}</th>
          <td>
            <span>
              {{ getMoneyString(travel.advance) }}
            </span>
            <!-- baseCurrency -->
            <span v-if="travel.advance.exchangeRate" class="text-secondary">
              &nbsp;-&nbsp;
              {{ getMoneyString(travel.advance, false) }}
            </span>
          </td>
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

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import StatePipeline from './StatePipeline.vue'
import PlaceElement from './PlaceElement.vue'
import { getMoneyString, datetoDateStringWithYear, getDiffInDays } from '../../../../common/scriptsts'
import { TravelSimple } from '../../../../common/types'

const keys = [
  'traveler',
  'reason',
  'startDate',
  'endDate',
  'travelInsideOfEU',
  'editor',
  'comments',
  'claimSpouseRefund',
  'fellowTravelersNames'
]
export default defineComponent({
  name: 'TravelApply',
  data() {
    return {
      keys
    }
  },
  components: { StatePipeline, PlaceElement },
  emits: ['cancel', 'edit', 'deleted'],
  props: {
    travel: { type: Object as PropType<TravelSimple>, required: true },
    showButtons: { type: Boolean, default: true }
  },
  methods: {
    displayKey(key: keyof TravelSimple): string {
      switch (key) {
        case 'startDate':
          return datetoDateStringWithYear(this.travel[key])
        case 'endDate':
          return (
            datetoDateStringWithYear(this.travel[key]) +
            ' (' +
            (getDiffInDays(this.travel.startDate, this.travel.endDate) + 1) +
            ' ' +
            this.$t('labels.days') +
            ')'
          )
        case 'state':
          return this.$t('states.' + this.travel[key])
        case 'editor':
          if (this.travel.traveler._id == this.travel.editor._id) {
            return ''
          }
          return this.travel[key].name
        case 'traveler':
          return this.travel[key].name
        case 'comments':
          if (this.travel.comments.length > 0) {
            return this.travel.comments[this.travel.comments.length - 1].text
          } else {
            return ''
          }
        default:
          if (typeof this.travel[key] == 'boolean') {
            return this.travel[key] ? '✅' : ''
          }
          if (this.travel[key]) {
            return this.travel[key]!.toString()
          } else {
            return ''
          }
      }
    },
    getMoneyString
  },
  mounted() {}
})
</script>

<style></style>
