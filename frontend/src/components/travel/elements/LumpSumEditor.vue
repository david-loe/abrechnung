<template>
  <form @submit.prevent="disabled ? null : $emit('save', days)">
    <table class="table table-hover align-middle text-center">
      <thead>
        <tr class="border-0">
          <th class="border-0" scope="col"></th>
          <th class="border-0 p-0 pt-2" scope="col" colspan="3">
            {{ t('labels.catering') }} <InfoPoint class="ms-1" :text="t('info.cateringNoRefund')" />
          </th>
          <th class="border-0" scope="col"></th>
          <th class="border-0" scope="col"></th>
        </tr>
        <tr>
          <th class="pt-0" scope="col">{{ t('labels.day') }}</th>

          <td class="pt-0" v-for="key of meals" :key="key">
            <small>{{ t(`labels.${key}`) }}</small>
          </td>
          <th class="pt-0" scope="col">{{ t('labels.overnight') }} <InfoPoint class="ms-1" :text="t('info.noOvernightRefund')" /></th>

          <th class="pt-0" scope="col">{{ t('labels.purpose') }}</th>
        </tr>
      </thead>
      <tbody class="table-group-divider">
        <tr v-for="day of days">
          <th scope="row">
            {{ formatter.simpleDate(day.date) }} <span class="ms-1">{{ day.country.flag || '' }}</span>
          </th>
          <td v-for="key of meals" :key="key">
            <input class="form-check-input p-2" type="checkbox" v-model="day.cateringNoRefund[key]" :disabled="disabled" />
          </td>
          <td>
            <input class="form-check-input" type="checkbox" v-model="day.noOvernightRefund" :disabled="disabled" />
          </td>
          <td>
            <select class="form-select form-select-sm" v-model="day.purpose" :disabled="disabled" required>
              <option v-for="purpose of ['professional', 'private']" :value="purpose" :key="purpose">
                {{ t('labels.' + purpose) }}
              </option>
            </select>
          </td>
        </tr>
      </tbody>
    </table>
    <div class="mb-1 d-flex align-items-center">
      <button type="submit" class="btn btn-primary me-2" v-if="!disabled" :disabled="loading">
        {{ t('labels.save') }}
      </button>
      <span v-if="loading" class="spinner-border spinner-border-sm ms-1 me-3"></span>
      <button type="button" class="btn btn-light" @click="$emit('cancel')">
        {{ $t('labels.cancel') }}
      </button>
    </div>
  </form>
</template>
<script lang="ts" setup>
import { TravelDay, meals } from '@/../../common/types.js'
import InfoPoint from '@/components/elements/InfoPoint.vue'
import { formatter } from '@/formatter.js'
import { PropType, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  days: { type: Array as PropType<TravelDay[]>, required: true },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits<{ save: [days: TravelDay[]]; cancel: [] }>()
</script>
