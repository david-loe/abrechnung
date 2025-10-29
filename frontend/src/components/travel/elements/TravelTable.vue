<template>
  <div
    v-for="row of table"
    class="mb-2"
    :key="row.type === 'gap' ? (row.data as Gap).departure.toString() : (row.data as TravelRecord<string> | TravelDay<string>)._id">
    <!-- day -->
    <div v-if="row.type === 'day'" class="row align-items-center mt-3">
      <div class="col-auto">
        <h5 class="m-0">
          <small
            v-if="(row.data as TravelDay).purpose === 'private'"
            :title="t('labels.private')"
            style="margin-left: -1.25rem; margin-right: 0.156rem">
            <i class="bi bi-file-person"></i> </small
          >{{ formatter.simpleDate((row.data as TravelDay).date) }}
        </h5>
      </div>
      <div class="col">
        <div class="row align-items-center">
          <!-- lump sums -->
          <!-- catering -->
          <div
            class="col-auto text-secondary"
            :title="
                          (travel.claimSpouseRefund ? '2x ' : '') +
                          t('lumpSums.' + row.data.lumpSums.catering.type) +
                          ' ' +
                          (row.data as TravelDay).country.flag +
                          ((row.data as TravelDay).special ? ' (' + (row.data as TravelDay).special + ')' : '')
                        ">
            <i class="bi bi-sun"></i>
            {{ formatter.money(row.data.lumpSums.catering.refund) }}
          </div>
          <!-- overnight -->
          <div
            class="col-auto text-secondary"
            :title="
                          (travel.claimSpouseRefund ? '2x ' : '') +
                          t('lumpSums.overnight') +
                          ' ' +
                          (row.data as TravelDay).country.flag +
                          ((row.data as TravelDay).special ? ' (' + (row.data as TravelDay).special + ')' : '')
                        ">
            <i class="bi bi-moon"></i>
            {{ formatter.money(row.data.lumpSums.overnight.refund) }}
          </div>
        </div>
      </div>
    </div>
    <!-- Stage -->
    <div
      v-else-if="row.type === 'stage'"
      class="row align-items-center clickable ps-lg-4 mb-1"
      @click="emit('showModal', 'edit', 'stage', row.data as Stage)">
      <div class="col-auto fs-3 d-none d-md-block">
        <i :class="getStageIcon(row.data as Stage)"></i>
      </div>
      <div class="col-auto text-truncate">
        <PlaceElement :place="(row.data as Stage).startLocation"></PlaceElement>
        <i :class="getStageIcon(row.data as Stage) + ' d-md-none'"></i>&nbsp;<i class="bi bi-arrow-right mx-2"></i>
        <div v-if="(row.data as Stage).cost.amount" class="ms-3 text-secondary d-inline d-md-none">
          <i class="bi bi-coin"></i>
          {{ formatter.money((row.data as Stage).cost) }}
        </div>
        <PlaceElement :place="(row.data as Stage).endLocation"></PlaceElement>
      </div>
      <div v-if="(row.data as Stage).cost.amount" class="col-auto text-secondary d-none d-md-block">
        <i class="bi bi-coin"></i>
        {{ formatter.money((row.data as Stage).cost) }}
      </div>
    </div>
    <!-- expense -->
    <div
      v-else-if="row.type === 'expense'"
      class="row align-items-center clickable ps-lg-4 mb-1"
      @click="emit('showModal', 'edit', 'expense', row.data as TravelExpense)">
      <div class="col-auto fs-3 d-none d-md-block">
        <i class="bi bi-coin"></i>
      </div>
      <div class="col-auto">
        <i class="bi bi-coin d-md-none"></i>&nbsp; {{ (row.data as TravelExpense).description }}&nbsp;
        <div class="text-secondary d-inline d-md-none">
          {{ formatter.money((row.data as TravelExpense).cost) }}
        </div>
      </div>
      <div class="col-auto text-secondary d-none d-md-block">
        {{ formatter.money((row.data as TravelExpense).cost) }}
      </div>
    </div>
    <!-- gap -->
    <div v-else-if="row.type === 'gap'" class="row ps-5">
      <div class="col-auto">
        <button class="btn btn-sm btn-light" @click="emit('showModal', 'add', 'stage', row.data as Gap)" style="border-radius: 50%">
          <i class="bi bi-plus-lg"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { Stage, Travel, TravelDay, TravelExpense, TravelRecord, TravelRecordType } from 'abrechnung-common/types.js'
import { PropType, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatter } from '../../../formatter.js'
import PlaceElement from '../../elements/PlaceElement.vue'

const { t } = useI18n()

type Gap = { departure: Stage['arrival']; startLocation: Stage['endLocation'] }

type Table = (
  | { type: 'stage'; data: Stage }
  | { type: 'expense'; data: TravelExpense }
  | { type: 'day'; data: TravelDay }
  | { type: 'gap'; data: Gap }
)[]

const props = defineProps({ travel: { type: Object as PropType<Travel<string>>, required: true } })
const emit = defineEmits<{
  (e: 'showModal', m: 'add', t: 'stage', d: Gap): void
  (e: 'showModal', m: 'edit', t: 'stage', d: Stage): void
  (e: 'showModal', m: 'edit', t: 'expense', d: TravelExpense): void
}>()

const table = ref<Table>([])

function renderTable() {
  table.value = []
  let stageIndex = 0
  // Füge zuerst alle Ausgaben ein, die vor dem ersten Reisetag liegen:
  for (const expense of props.travel.expenses) {
    if (props.travel.days.length === 0 || expense.cost.date < props.travel.days[0].date) {
      table.value.push({ type: 'expense', data: expense })
    }
  }
  // Durchlaufe die Tage und ordne Stages und Ausgaben zu:
  for (let i = 0; i < props.travel.days.length; i++) {
    const stagesStart = stageIndex
    while (
      stageIndex < props.travel.stages.length &&
      i < props.travel.days.length - 1 &&
      new Date(props.travel.days[i + 1].date).valueOf() - new Date(props.travel.stages[stageIndex].departure).valueOf() > 0
    ) {
      stageIndex++
    }
    let stagesEnd = stageIndex
    if (i === props.travel.days.length - 1) {
      stagesEnd = props.travel.stages.length
    }
    table.value.push({ type: 'day', data: { ...props.travel.days[i] } as TravelDay })
    for (const expense of props.travel.expenses) {
      if (expense.cost.date === props.travel.days[i].date) {
        table.value.push({ type: 'expense', data: expense })
      }
    }
    for (const stage of props.travel.stages.slice(stagesStart, stagesEnd)) {
      table.value.push({ type: 'stage', data: stage })
    }
  }
  // Füge eine "Gap" ein, falls vorhanden:
  if (props.travel.stages.length > 0) {
    const last = props.travel.stages[props.travel.stages.length - 1]
    table.value.push({ type: 'gap', data: { departure: last.arrival, startLocation: last.endLocation } })
  }
  // Füge alle Ausgaben ein, die nach dem letzten Tag liegen:
  if (props.travel.days.length > 0) {
    for (const expense of props.travel.expenses) {
      if (expense.cost.date > props.travel.days[props.travel.days.length - 1].date) {
        table.value.push({ type: 'expense', data: expense })
      }
    }
  }
}

function getStageIcon(stage: Stage) {
  let icon: string | null = null
  if (stage.transport.type === 'ownCar') {
    icon = 'bi bi-car-front'
  } else if (stage.transport.type === 'airplane') {
    icon = 'bi bi-airplane'
  } else if (stage.transport.type === 'shipOrFerry') {
    icon = 'bi bi-water'
  } else if (stage.transport.type === 'otherTransport') {
    icon = 'bi bi-train-front'
  }
  return icon
}

function getNext(record: TravelRecord, type: TravelRecordType) {
  const index = table.value.findIndex((e) => e.type === type && e.data._id === record._id)
  if (index === -1) {
    return undefined
  }
  for (let i = index + 1; i < table.value.length; i++) {
    if (table.value[i].type === 'stage' || table.value[i].type === 'expense') {
      return table.value[i] as { type: 'stage'; data: Stage } | { type: 'expense'; data: TravelExpense }
    }
  }
}

function getPrev(record: TravelRecord, type: TravelRecordType) {
  const index = table.value.findIndex((e) => e.type === type && e.data._id === record._id)
  if (index === -1 || index === 0) {
    return undefined
  }
  for (let i = index - 1; i >= 0; i--) {
    if (table.value[i].type === 'stage' || table.value[i].type === 'expense') {
      return table.value[i] as { type: 'stage'; data: Stage } | { type: 'expense'; data: TravelExpense }
    }
  }
}

defineExpose({ getNext, getPrev })

watch(() => props.travel, renderTable)
watch(() => props.travel.expenses, renderTable)
watch(() => props.travel.stages, renderTable)
watch(() => props.travel.days, renderTable)
renderTable()
</script>
