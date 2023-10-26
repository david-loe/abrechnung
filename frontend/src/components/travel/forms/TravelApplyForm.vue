<template>
  <form class="container" @submit.prevent="mode === 'add' ? $emit('add', output()) : $emit('edit', output())">
    <div class="mb-2">
      <label for="travelFormName" class="form-label">
        {{ $t('labels.travelName') }}
      </label>
      <input type="text" class="form-control" id="travelFormName" v-model="formTravel.name" />
    </div>

    <div class="mb-2">
      <label for="travelFormDestinationPlace" class="form-label me-2">
        {{ $t('labels.destinationPlace') }}<span class="text-danger">*</span>
      </label>

      <InfoPoint :text="$t('info.destinationPlace')" />
      <PlaceInput id="travelFormDestinationPlace" v-model="formTravel.destinationPlace" :required="true"></PlaceInput>
    </div>

    <div class="form-check mb-3">
      <input class="form-check-input" type="checkbox" v-model="formTravel.travelInsideOfEU" id="travelFormTravelInsideOfEU" />
      <label class="form-check-label me-2" for="travelFormTravelInsideOfEU"> {{ $t('labels.travelInsideOfEU') }} </label>
      <InfoPoint :text="$t('info.travelInsideOfEU')" />
    </div>

    <div class="mb-2">
      <label for="travelFormReason" class="form-label me-2"> {{ $t('labels.reason') }}<span class="text-danger">*</span> </label>
      <InfoPoint :text="$t('info.reason')" />
      <input type="text" class="form-control" id="travelFormReason" v-model="formTravel.reason" required />
    </div>

    <div class="row mb-3">
      <div class="col-auto">
        <label for="startDateInput" class="form-label">{{ $t('labels.from') }}<span class="text-danger">*</span></label>
        <DateInput id="startDateInput" v-model="formTravel.startDate" :min="new Date()" required />
      </div>
      <div class="col-auto">
        <label for="endDateInput" class="form-label">{{ $t('labels.to') }}<span class="text-danger">*</span></label>
        <DateInput id="endDateInput" v-model="formTravel.endDate" :min="(formTravel.startDate as string)" :max="getMaxDate()" required />
      </div>
    </div>

    <template v-if="settings.allowSpouseRefund">
      <div class="form-check mb-3">
        <input class="form-check-input" type="checkbox" id="travelFormClaimSpouseRefund" v-model="formTravel.claimSpouseRefund" />
        <label class="form-check-label me-2" for="travelFormClaimSpouseRefund">
          {{ $t('labels.claimSpouseRefund') }}
        </label>
        <InfoPoint :text="$t('info.claimSpouseRefund')" />
      </div>

      <div class="mb-2">
        <label for="travelFormFellowTravelersNames" class="form-label me-2">
          {{ $t('labels.fellowTravelersNames') }}<span v-if="formTravel.claimSpouseRefund" class="text-danger">*</span>
        </label>
        <InfoPoint :text="$t('info.fellowTravelersNames')" />
        <input
          type="text"
          class="form-control"
          id="travelFormFellowTravelersNames"
          v-model="formTravel.fellowTravelersNames"
          :required="formTravel.claimSpouseRefund" />
      </div>
    </template>

    <label for="travelFormAdvance" class="form-label me-2">
      {{ $t('labels.advance') }}
    </label>
    <InfoPoint :text="$t('info.advance')" />

    <div class="input-group mb-2" id="travelFormAdvance">
      <input type="number" class="form-control" step="0.01" id="travelFormAdvanceAmount" v-model="formTravel.advance.amount" />
      <CurrencySelector v-model="formTravel.advance.currency" :required="true"></CurrencySelector>
    </div>

    <div class="mb-2">
      <button type="submit" class="btn btn-primary me-2" :disabled="loading">
        <span v-if="loading" class="spinner-border spinner-border-sm"></span>
        {{
          mode === 'add'
            ? $t('labels.applyForX', { X: $t('labels.travel') })
            : travel.state === 'rejected' || travel.state === 'approved'
            ? $t('labels.reapplyForX', { X: $t('labels.travel') })
            : $t('labels.save')
        }}
      </button>
      <button type="button" class="btn btn-light" v-on:click="$emit('cancel')">
        {{ $t('labels.cancel') }}
      </button>
    </div>
  </form>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import CurrencySelector from '../../elements/CurrencySelector.vue'
import InfoPoint from '../../elements/InfoPoint.vue'
import PlaceInput from '../../elements/PlaceInput.vue'
import DateInput from '../../elements/DateInput.vue'
import { TravelSimple, Place } from '../../../../../common/types.js'
import settings from '../../../../../common/settings.json'
import { datetimeToDateString, isValidDate } from '../../../../../common/scripts.js'

interface FormTravelSimple
  extends Omit<TravelSimple, 'destinationPlace' | 'traveler' | 'state' | 'editor' | 'comments' | 'progress' | '_id'> {
  destinationPlace?: Place
}

const defaultTravel: FormTravelSimple = {
  name: '',
  reason: '',
  startDate: '',
  endDate: '',
  destinationPlace: undefined,
  travelInsideOfEU: false,
  claimSpouseRefund: false,
  advance: {
    amount: null,
    currency: settings.baseCurrency
  }
}
export default defineComponent({
  name: 'TravelApplyForm',
  components: { CurrencySelector, InfoPoint, PlaceInput, DateInput },
  emits: ['cancel', 'edit', 'add'],
  props: {
    travel: {
      type: Object as PropType<Partial<TravelSimple>>,
      default: () => structuredClone(defaultTravel)
    },
    mode: {
      type: String as PropType<'add' | 'edit'>,
      required: true
    }
  },
  data() {
    return {
      formTravel: structuredClone(defaultTravel),
      loading: false,
      settings
    }
  },
  methods: {
    clear() {
      this.loading = false
      this.formTravel = structuredClone(defaultTravel)
    },
    output() {
      this.loading = true
      return this.formTravel
    },
    input() {
      this.loading = false
      return Object.assign({}, structuredClone(defaultTravel), this.travel)
    },
    getMaxDate() {
      const date = isValidDate(this.formTravel.startDate as string)
      if (date) {
        return datetimeToDateString(date.valueOf() + settings.maxTravelDayCount * 1000 * 60 * 60 * 24)
      } else {
        return ''
      }
    }
  },
  beforeMount() {
    this.formTravel = this.input()
  },
  watch: {
    travel: function () {
      this.formTravel = this.input()
    }
  }
})
</script>

<style></style>
