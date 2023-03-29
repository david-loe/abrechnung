<template>
  <form class="container" @submit.prevent="mode === 'add' ? $emit('add', output()) : $emit('edit', output())">
    <div class="mb-2">
      <label for="travelFormName" class="form-label">
        {{ $t('labels.name') }}
      </label>
      <input type="text" class="form-control" id="travelFormName" v-model="formTravel.name" />
    </div>

    <div class="mb-2">
      <label for="travelFormDestinationPlace" class="form-label me-2">
        {{ $t('labels.destinationPlace') }}
      </label>
      <InfoPoint :text="$t('info.destinationPlace')" />
      <input type="text" class="form-control" id="travelFormDestinationPlace" v-model="formTravel.destinationPlace" required />
    </div>

    <div class="form-check mb-3">
      <input class="form-check-input" type="checkbox" v-model="formTravel.travelInsideOfEU" id="travelFormTravelInsideOfEU" />
      <label class="form-check-label me-2" for="travelFormTravelInsideOfEU"> {{$t('labels.travelInsideOfEU')}} </label>
      <InfoPoint :text="$t('info.travelInsideOfEU')" />
    </div>

    <div class="mb-2">
      <label for="travelFormReason" class="form-label me-2">
        {{ $t('labels.reason') }}
      </label>
      <InfoPoint :text="$t('info.reason')" />
      <input type="text" class="form-control" id="travelFormReason" v-model="formTravel.reason" required />
    </div>

    <div class="row mb-2">
      <div class="col-auto">
        <label for="startDateInput" class="form-label">{{ $t('labels.from') }}</label>
        <input id="startDateInput" class="form-control" type="date" v-model="formTravel.startDate" required />
      </div>
      <div class="col-auto">
        <label for="endDateInput" class="form-label">{{ $t('labels.to') }}</label>
        <input id="endDateInput" class="form-control" type="date" v-model="formTravel.endDate" required v-bind:min="formTravel.startDate" />
      </div>
    </div>

    <label for="travelFormAdvance" class="form-label me-2">
      {{ $t('labels.advance') }}
    </label>
    <InfoPoint :text="$t('info.advance')" />

    <div class="input-group mb-2" id="travelFormAdvance">
      <input type="number" class="form-control" id="travelFormAdvanceAmount" v-model="formTravel.advance.amount" required />
      <CurrencySelector v-model="formTravel.advance.currency" :required="true"></CurrencySelector>
    </div>

    <div class="mb-2">
      <button type="submit" class="btn btn-primary me-2" v-if="mode === 'add'">
        {{ $t('labels.applyForX', { X: $t('labels.travel') }) }}
      </button>
      <button type="submit" class="btn btn-primary me-2" v-if="mode === 'edit'">
        {{ $t('labels.save') }}
      </button>
      <button type="button" class="btn btn-light" v-on:click="$emit('cancel')">
        {{ $t('labels.cancel') }}
      </button>
    </div>
  </form>
</template>

<script>
import CurrencySelector from '../Elements/CurrencySelector.vue'
import InfoPoint from '../Elements/InfoPoint.vue'
export default {
  name: 'TravelApplyForm',
  components: { CurrencySelector, InfoPoint },
  emits: ['cancel', 'edit', 'add'],
  props: {
    travel: {
      type: Object,
      default: function () {
        return {
          name: '',
          reason: '',
          startDate: '',
          endDate: '',
          destinationPlace: '',
          travelInsideOfEU: false,
          advance: {
            amount: 0,
            currency: 'EUR',
          },
        }
      },
    },
    mode: {
      type: String,
      required: true,
      validator: function (value) {
        return ['add', 'edit'].indexOf(value) !== -1
      },
    },
  },
  data() {
    return {
      formTravel: this.travel,
    }
  },
  methods: {
    clear() {
      this.formTravel = {
        name: '',
        reason: '',
        startDate: '',
        endDate: '',
        advance: {
          amount: 0,
          currency: 'EUR',
        },
      }
    },
    output() {
      const output = Object.assign({}, this.formTravel)
      output.startDate = new Date(output.startDate)
      output.endDate = new Date(output.endDate)
      return output
    },
    input(){
      const input = Object.assign({}, this.travel)
      input.startDate = this.$root.dateToHTMLInputString(input.startDate)
      input.endDate = this.$root.dateToHTMLInputString(input.endDate)
      return input
    }
  },
  beforeMount() {
    this.formTravel = this.input()
  },
  watch: {
    travel: function () {
      this.formTravel = this.input()
    },
  },
}
</script>

<style>
</style>