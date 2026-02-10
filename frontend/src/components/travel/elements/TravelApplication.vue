<template>
  <div v-if="props.travel._id">
    <StatePipeline class="mb-3" :state="props.travel.state" :StateEnum="TravelState" />
    <table class="table">
      <tbody>
        <tr v-for="key of keys" :key="key">
          <template v-if="displayKey(key)">
            <th>{{ t('labels.' + key) }}</th>
            <td>{{ displayKey(key) }}</td>
          </template>
        </tr>
        <tr>
          <th>{{ t('labels.destinationPlace') }}</th>
          <td>
            <PlaceElement :place="props.travel.destinationPlace" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script lang="ts" setup>
import { TravelSimple, TravelState } from 'abrechnung-common/types.js'
import { getDiffInDays } from 'abrechnung-common/utils/scripts.js'
import { PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import PlaceElement from '@/components/elements/PlaceElement.vue'
import StatePipeline from '@/components/elements/StatePipeline.vue'
import { formatter } from '@/formatter.js'

const keys = [
  'traveler',
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
] as const
const { t } = useI18n()

const props = defineProps({ travel: { type: Object as PropType<TravelSimple>, required: true } })

function displayKey(key: (typeof keys)[number]): string {
  switch (key) {
    case 'startDate':
      return formatter.date(props.travel[key])
    case 'endDate': {
      const dif = getDiffInDays(props.travel.startDate, props.travel.endDate) + 1
      return `${formatter.date(props.travel[key])} (${dif} ${t(`labels.${dif === 1 ? 'day' : 'days'}`)})`
    }
    case 'editor':
      if (props.travel.owner._id === props.travel.editor._id) {
        return ''
      }
      return formatter.name(props.travel[key].name)
    case 'traveler':
      return formatter.name(props.travel.owner.name)
    case 'comments':
      if (props.travel.comments.length > 0) {
        const c = props.travel.comments[props.travel.comments.length - 1]
        return `${c.author.name.givenName}: "${c.text}"`
      }
      return ''
    case 'a1Certificate':
      if (props.travel.a1Certificate) {
        return `${props.travel.a1Certificate.destinationName} - ${props.travel.a1Certificate.exactAddress}`
      }
      return ''
    case 'advances':
      if (props.travel.advances.length > 0) {
        return props.travel.advances
          .map(
            (a) =>
              `${a.name} - ${formatter.money(a.balance)} ${a.budget.amount !== a.balance.amount ? `(${formatter.money(a.budget)})` : ''}`
          )
          .join('\n')
      }
      return ''
    case 'project':
      return `${props.travel.project.identifier} - ${props.travel.project.name || ''}`

    default:
      if (typeof props.travel[key] === 'boolean') {
        return props.travel[key] ? '✅' : ''
      }
      if (props.travel[key]) {
        return props.travel[key]?.toString()
      }
      return ''
  }
}
</script>

<style></style>
