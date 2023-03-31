<template>
  <form class="container" @submit.prevent="mode === 'add' ? $emit('add', output()) : $emit('edit', output())">
    <ul class="nav nav-pills nav-justified mb-3">
      <li class="nav-item">
        <a href="#" :class="'nav-link' + (formRecord.type == 'route' ? ' active' : '')" @click="formRecord.type = 'route'">
          {{ $t('labels.route')}} <i class="bi bi-bus-front-fill"></i>
          </a>
      </li>
      <li class="nav-item">
        <a href="#" :class="'nav-link' + (formRecord.type == 'stay' ? ' active' : '')" @click="formRecord.type = 'stay'">
          {{$t('labels.stay')}} <i class="bi bi-house-fill"></i>
          </a>
      </li>
    </ul>

    <div class="row mb-3">
      <div class="col-auto">
        <label for="startDateInput" class="form-label">{{ $t('labels.from') }}</label>
        <input
          id="startDateInput"
          class="form-control"
          type="datetime-local"
          v-model="formRecord.startDate"
          required
        />
      </div>
      <div class="col-auto">
        <label for="endDateInput" class="form-label">{{ $t('labels.to') }}</label>
        <input
          id="endDateInput"
          class="form-control"
          type="datetime-local"
          v-model="formRecord.endDate"
          :min="formRecord.startDate"
          required
        />
      </div>
    </div>

    <template v-if="formRecord.type == 'route'">
      <div class="row mb-3">
        <div class="col">
          <label for="recordFormStartLocation" class="form-label">
            {{ $t('labels.startLocation') }}
          </label>
          <input type="text" class="form-control" id="recordFormStartLocation" v-model="formRecord.startLocation" required/>
        </div>
        <div class="col">
          <label for="recordFormEndLocation" class="form-label">
            {{ $t('labels.endLocation') }}
          </label>
          <input type="text" class="form-control" id="recordFormEndLocation" v-model="formRecord.endLocation" required/>
        </div>
      </div>

      <label for="recordFormTransport" class="form-label me-2">
        {{ $t('labels.transport') }}
      </label>
      <InfoPoint :text="$t('info.transport')" />
      <select class="form-select mb-3" v-model="formRecord.transport" id="recordFormTransport" required>
        <option value="other">{{ $t('labels.otherTransport') }}</option>
        <option value="ownCar">{{ $t('labels.ownCar') }}</option>
      </select>
    </template>

    <template v-else>
      <div class="mb-3">
        <label for="recordFormLocation" class="form-label">
          {{ $t('labels.location') }}
        </label>
        <input type="text" class="form-control" id="recordFormLocation" v-model="formRecord.location" required/>
      </div>
    </template>

    <template v-if="(formRecord.type == 'route' && formRecord.transport == 'ownCar')">
      <div class="mb-3">
        <label for="recordFormEndLocation" class="form-label">
          {{ $t('labels.distance') }}
        </label>
        <input type="number" class="form-control" v-model="formRecord.distance" required />
      </div>
    </template>

    <template v-if="(formRecord.type == 'route' && formRecord.transport == 'other') || (formRecord.type == 'stay' && askStayCost)">
      <label for="recordFormCost" class="form-label me-2">
        {{ $t('labels.cost') }}
      </label>
      <InfoPoint :text="$t('info.cost')" />
      <div class="input-group mb-2" id="recordFormCost">
        <input type="number" class="form-control" v-model="formRecord.cost.amount" min="0" required />
        <CurrencySelector v-model="formRecord.cost.currency" :required="true"></CurrencySelector>
      </div>
      <div class="mb-3">
        <label for="recordFormFile" class="form-label me-2">{{ $t('labels.receipt') }}</label>
        <InfoPoint :text="$t('info.receipt')" />
        <input class="form-control" type="file" id="recordFormFile" accept="image/png, image/jpeg, .pdf" required/>
      </div>
    </template>

    <template v-if="askPurpose">
      <label for="recordFormPurpose" class="form-label me-2">
        {{ $t('labels.purpose') }}
      </label>
      <InfoPoint :text="$t('info.purpose')" />
      <select class="form-select mb-3" v-model="formRecord.purpose" id="recordFormPurpose" required>
        <option value="professional">{{ $t('labels.professional') }}</option>
        <option value="mixed">{{ $t('labels.mixed') }}</option>
        <option value="private">{{ $t('labels.private') }}</option>
      </select>
    </template>

    <div class="mb-1">
      <button type="submit" class="btn btn-primary me-2" v-if="mode === 'add'">
        {{ $t('labels.addX', { X: $t('labels.record') }) }}
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
  name: 'RecordForm',
  components: { InfoPoint, CurrencySelector },
  emits: ['cancel', 'edit', 'add'],
  props: {
    record: {
      type: Object,
      default: function () {
        return {
          type: 'route',
          startDate: '',
          endDate: '',
          startLocation: null,
          endLocation: null,
          distance: null,
          location: null,
          transport: 'other',
          cost: {
            amount: null,
            currency: 'EUR',
            receipt: null,
          },
          purpose: 'professional',
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
    askPurpose: { type: Boolean, default: true },
    askStayCost: { type: Boolean, default: true },
  },
  data() {
    return {
      formRecord: undefined,
    }
  },
  methods: {
    clear() {
      this.formRecord = {
        type: 'route',
        startDate: '',
        endDate: '',
        startLocation: '',
        endLocation: '',
        transport: 'other',
        cost: {
          amount: 0,
          currency: 'EUR',
          receipt: null,
        },
        purpose: 'professional',
      }
    },
    output() {
      const output = Object.assign({}, this.formRecord)
      output.startDate = new Date(output.startDate)
      output.endDate = new Date(output.endDate)
      return output
    },
    input() {
      const input = Object.assign({}, this.record)
      input.startDate = this.$root.dateTimeToHTMLInputString(input.startDate)
      input.endDate = this.$root.dateTimeToHTMLInputString(input.endDate)
      return input
    },
  },
  beforeMount() {
    this.formRecord = this.input()
  },
  watch: {
    record: function () {
      this.formRecord = this.input()
    },
  },
}
</script>

<style>
</style>