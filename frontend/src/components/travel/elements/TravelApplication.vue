<template>
  <div v-if="travel._id">
    <StatePipeline class="mb-3" :state="travel.state" :StateEnum="TravelState"></StatePipeline>
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
          <td>
            <PlaceElement :place="travel.destinationPlace"></PlaceElement>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { getDiffInDays } from '@/../../common/scripts.js'
import { TravelSimple, TravelState } from '@/../../common/types.js'
import PlaceElement from '@/components/elements/PlaceElement.vue'
import StatePipeline from '@/components/elements/StatePipeline.vue'
import { formatter } from '@/formatter.js'

const keys: (keyof TravelSimple)[] = [
  'owner',
  'project',
  'reason',
  'startDate',
  'endDate',
  'editor',
  'comments',
  'advances',
  'claimSpouseRefund',
  'fellowTravelersNames',
  'a1Certificate'
]
export default defineComponent({
  name: 'TravelApply',
  data() {
    return {
      keys,
      TravelState
    }
  },
  components: { StatePipeline, PlaceElement },
  props: {
    travel: { type: Object as PropType<TravelSimple>, required: true }
  },
  methods: {
    displayKey(key: keyof TravelSimple): string {
      switch (key) {
        case 'startDate':
          return formatter.date(this.travel[key])
        case 'endDate': {
          const dif = getDiffInDays(this.travel.startDate, this.travel.endDate) + 1
          return `${formatter.date(this.travel[key])} (${dif} ${this.$t(`labels.${dif === 1 ? 'day' : 'days'}`)})`
        }
        case 'state':
          return this.$t(`states.${this.travel[key]}`)
        case 'editor':
          if (this.travel.owner._id === this.travel.editor._id) {
            return ''
          }
          return formatter.name(this.travel[key].name)
        case 'owner':
          return formatter.name(this.travel[key].name)
        case 'comments':
          if (this.travel.comments.length > 0) {
            const c = this.travel.comments[this.travel.comments.length - 1]
            return `${c.author.name.givenName}: "${c.text}"`
          }
          return ''
        case 'a1Certificate':
          if (this.travel.a1Certificate) {
            return `${this.travel.a1Certificate.destinationName} - ${this.travel.a1Certificate.exactAddress}`
          }
          return ''
        case 'advances':
          if (this.travel.advances.length > 0) {
            return this.travel.advances
              .map(
                (a) =>
                  `${a.name} - ${formatter.money(a.balance)} ${
                    a.budget.amount !== a.balance.amount ? `(${formatter.money(a.budget)})` : ''
                  }`
              )
              .join('\n')
          }
          return ''
        case 'project':
          return `${this.travel.project.identifier} - ${this.travel.project.name || ''}`

        default:
          if (typeof this.travel[key] === 'boolean') {
            return this.travel[key] ? '✅' : ''
          }
          if (this.travel[key]) {
            return this.travel[key]?.toString()
          }
          return ''
      }
    }
  },
  mounted() {}
})
</script>

<style></style>
