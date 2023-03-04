<template>
  <form class="container" @submit.prevent="mode === 'add' ? $emit('add', output()) : $emit('edit', output())">
    <div class="mb-2">
      <label for="travelFormName" class="form-label">
        {{ $t('labels.name') }}
      </label>
      <input type="text" class="form-control" id="travelFormName" v-model="formTravel.name" />
    </div>

    <div class="mb-2">
      <label for="travelFormReason" class="form-label">
        {{ $t('labels.reason') }}
      </label>
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

    <label for="travelFormAdvance" class="form-label">
      {{ $t('labels.advance') }}
    </label>

    <div class="input-group mb-2" id="travelFormAdvance">
      <input type="number" class="form-control" id="travelFormAdvanceAmount" v-model="formTravel.advance.amount" />
      <v-select :options="$root.currencies" style="min-width: 250px">
        <template #option="{ name, code, symbol, flag }">
          <h3 style="margin: 0">{{ flag }}</h3>
          <em>{{ name.de }} {{ symbol }} {{ code }}</em>
        </template>
        <template #selected-option="{ code, symbol, flag }">
            <strong>{{ symbol ? symbol : code }}</strong> <span>{{flag}}</span>
        </template>
      </v-select>
    </div>

    <div class="mb-2">
      <button type="submit" class="btn btn-primary me-2" v-if="mode === 'add'">
        {{ $t('labels.add') }}
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
export default {
  components: {},
  name: 'TravelApplyForm',
  props: {
    travel: {
      type: Object,
      default: function () {
        return {
          name: '',
          reason: '',
          startDate: '',
          endDate: '',
          advance: {
            amount: null,
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
          amount: null,
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
  },
  beforeMount() {},
  watch: {
    travel: function () {
      this.formTravel = this.travel
    },
  },
}
</script>

<style>
</style>