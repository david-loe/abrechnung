<template>
  <form @submit.prevent="disabled ? null : emit('save', localDays, localLastPlaceOfWork)">
    <table class="table table-sm table-hover align-middle text-center">
      <thead>
        <tr>
          <th class="border-0" scope="col"></th>
          <th class="border-0 p-0 pt-1" scope="col" colspan="3">
            {{ t('labels.catering') }}
            <InfoPoint class="ms-1" :text="t('info.cateringRefund')" />
          </th>
          <th class="border-0" scope="col"></th>
          <th class="border-0" scope="col"></th>
        </tr>
        <tr>
          <th class="py-0 border-0" scope="col">{{ t('labels.day') }}</th>

          <td class="py-0 border-0" v-for="meal of meals" :key="meal">
            <small class="d-lg-inline d-none">{{ t(`labels.${meal}`) }}</small>
            <span class="fs-3 d-lg-none d-inline">{{ emojis[meal] }}</span>
          </td>
          <th class="py-0 border-0 text-nowrap" scope="col">
            <span class="d-lg-inline d-none">{{ t('labels.overnight') }}</span>
            <span class="fs-3 d-lg-none d-inline">{{ emojis.overnight }}</span>
            <InfoPoint class="ms-1" :text="t('info.overnightRefund')" />
          </th>

          <th class="py-0 border-0 text-nowrap" scope="col">
            {{ t('labels.purpose') }}
            <InfoPoint
              class="ms-1"
              :text="t('info.professionalShareX%', { X: Math.round(props.travelSettings.minProfessionalShare * 100) })" />
          </th>
        </tr>
        <tr>
          <td></td>
          <td class="py-0 px-2 text-nowrap" v-for="meal in lumpSums" :key="meal">
            <span v-if="!disabled" class="d-sm-inline d-none">
              <span class="clickable text-primary" @click="setAll(meal, true)">
                <i class="bi bi-check-square"></i>
              </span>
              <span class="ms-2 clickable text-danger" @click="setAll(meal, false)">
                <i class="bi bi-x-square"></i>
              </span>
            </span>
          </td>
          <td v-if="professionalShare !== null" class="py-0">
            <small>
              <span class="d-lg-inline d-none"> {{ t('labels.professionalShare') + ': ' }}</span>
              <span :class="'d-sm-inline d-none' + (professionalShare <= props.travelSettings.minProfessionalShare ? ' text-danger' : '')">
                {{ Math.round(professionalShare * 100) + '%' }}
              </span>
            </small>
          </td>
        </tr>
      </thead>
      <tbody class="table-group-divider">
        <tr v-for="day of localDays">
          <th scope="row" class="text-nowrap">
            {{ formatter.simpleDate(day.date) }}
            <span class="ms-1">{{ day.country.flag || '' }}</span>
          </th>
          <template v-if="day.purpose === 'professional'">
            <td v-for="meal of meals" :key="meal">
              <input class="form-check-input m-0 p-2" type="checkbox" v-model="day.cateringRefund[meal]" :disabled="disabled" >
            </td>
            <td>
              <input class="form-check-input m-0 p-2" type="checkbox" v-model="day.overnightRefund" :disabled="disabled" >
            </td>
          </template>
          <template v-else>
            <td v-for="meal in lumpSums" :key="meal"></td>
          </template>
          <td>
            <select class="form-select form-select-sm" v-model="day.purpose" :disabled="disabled">
              <option v-for="purpose of ['professional', 'private']" :value="purpose" :key="purpose">{{ t('labels.' + purpose) }}</option>
            </select>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="mb-3 row">
      <div class="col">
        <label class="form-label me-2">{{ t('labels.lastPlaceOfWork') }}</label>
        <div class="d-inline-flex flex-shrink-1 me-2">
          <select class="form-select form-select-sm" v-model="localLastPlaceOfWork" :disabled="disabled">
            <option v-for="place of lastPlaceOfWorkList" :value="place" :key="place.country._id + place.special">
              <PlaceElement :place="place" :showPlace="false" :showSpecial="true" />
            </option>
          </select>
        </div>
        <InfoPoint :text="t('info.lastPlaceOfWork')" />
      </div>
      <div class="col-auto">
        <span v-if="isCalculatingLumpSumsSum" class="spinner-border spinner-border-sm ms-1 me-3"></span>
        <span v-else class="text-secondary"> {{ formatter.money(lumpSumsSum) }}</span>
      </div>
    </div>

    <div class="mb-1 d-flex align-items-center">
      <button type="submit" class="btn btn-primary me-2" v-if="!disabled" :disabled="loading">{{ t('labels.save') }}</button>
      <span v-if="loading" class="spinner-border spinner-border-sm ms-1 me-3"></span>
      <button type="button" class="btn btn-light" @click="emit('cancel')">{{ $t('labels.cancel') }}</button>
    </div>
  </form>
</template>
<script lang="ts" setup>
import { TravelCalculator } from 'abrechnung-common/travel/calculator.js'
import { meals, Place, Travel, TravelDay, TravelSettings } from 'abrechnung-common/types.js'
import { getLumpSumsSum, mergeDeep } from 'abrechnung-common/utils/scripts.js'
import { computed, PropType, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatter } from '../../../formatter.js'
import InfoPoint from '../../elements/InfoPoint.vue'
import PlaceElement from '../../elements/PlaceElement.vue'

const emojis = { breakfast: '🥐', lunch: '🥪', dinner: '🍽️', overnight: '🛏️' } as const

const { t } = useI18n()

const props = defineProps({
  travel: { type: Object as PropType<Travel<string>>, required: true },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  travelSettings: { type: Object as PropType<TravelSettings>, required: true },
  travelCalculator: { type: Object as PropType<TravelCalculator>, required: true }
})
const emit = defineEmits<{ save: [days: TravelDay<string>[], lastPlaceOfWork: Travel['lastPlaceOfWork']]; cancel: [] }>()

const lastPlaceOfWorkList = ref<Omit<Place, 'place'>[]>([])
const localLastPlaceOfWork = ref(props.travel.lastPlaceOfWork)
const lumpSumsSum = ref(getLumpSumsSum(props.travel.days))
const isCalculatingLumpSumsSum = ref(false)
const localDays = ref<TravelDay<string>[]>([])

setup(props.travel)

function setup(travel: Travel<string>) {
  setLocalDays(travel.days)
  lastPlaceOfWorkList.value = getLastPaceOfWorkList(travel)
  if (props.travel.lastPlaceOfWork) {
    localLastPlaceOfWork.value = lastPlaceOfWorkList.value.find(
      (lpow) => lpow.country._id === props.travel.lastPlaceOfWork?.country._id && lpow.special === props.travel.lastPlaceOfWork?.special
    )
  }
}
function setLocalDays(days: TravelDay<string>[]) {
  const newDays: TravelDay<string>[] = []
  for (const day of days) {
    newDays.push(mergeDeep({}, day))
  }
  localDays.value = newDays
}
function getLastPaceOfWorkList(travelObj: Travel) {
  const list: Omit<Place, 'place'>[] = []
  function add(place: Place, list: Omit<Place, 'place'>[]) {
    let found = false
    for (const entry of list) {
      if (entry.country._id === place.country._id && entry.special === place.special) {
        found = true
        break
      }
    }
    if (!found) {
      const adding: Omit<Place, 'place'> = { country: place.country }
      if (place.special) {
        adding.special = place.special
      }
      list.push(adding)
    }
  }
  add(travelObj.destinationPlace, list)
  for (const stage of travelObj.stages) {
    add(stage.startLocation, list)
    add(stage.endLocation, list)
  }
  return list
}

const lumpSums = [...meals, 'overnight'] as const
type LumpSums = (typeof lumpSums)[number]

const professionalShare = computed(() => props.travelCalculator.getProfessionalShare(localDays.value))

function setAll(type: LumpSums, value: boolean) {
  if (type === 'overnight') {
    for (const day of localDays.value) {
      day.overnightRefund = value
    }
  } else {
    for (const day of localDays.value) {
      day.cateringRefund[type] = value
    }
  }
}
watch(
  () => props.travel,
  () => setup(props.travel)
)

watch(localLastPlaceOfWork, async (newLastPlace) => {
  setLocalDays(
    await props.travelCalculator.calculateDays(props.travel.stages, newLastPlace, props.travel.destinationPlace, localDays.value)
  )
})

watch(
  localDays,
  async (newLocalDays) => {
    isCalculatingLumpSumsSum.value = true
    try {
      const newCalculatedDays = await props.travelCalculator.calculateDays(
        props.travel.stages,
        localLastPlaceOfWork.value,
        props.travel.destinationPlace,
        newLocalDays
      )
      await props.travelCalculator.addCateringRefunds(newCalculatedDays, props.travel.stages, Boolean(props.travel.claimSpouseRefund))
      await props.travelCalculator.addOvernightRefunds(newCalculatedDays, props.travel.stages, Boolean(props.travel.claimSpouseRefund))
      lumpSumsSum.value = getLumpSumsSum(newCalculatedDays)
    } finally {
      isCalculatingLumpSumsSum.value = false
    }
  },
  { deep: true }
)
</script>

<style scoped>
input.form-check-input:not(:checked) {
  background-color: var(--bs-danger);
  border-color: var(--bs-danger);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cline x1='4' y1='4' x2='12' y2='12' stroke='white' stroke-width='2.5' stroke-linecap='round'/%3E%3Cline x1='12' y1='4' x2='4' y2='12' stroke='white' stroke-width='2.5' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: center;
  background-size: 90%;
}
</style>
