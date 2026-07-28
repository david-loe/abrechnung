<template>
  <ModalComponent ref="modal" :header="t('labels.exportBookings')">
    <div v-if="loadingPreview" class="text-center py-4"><span class="spinner-border"></span></div>
    <div v-else-if="showBookingConfirmation">
      <p>{{ t('labels.markBookingsAsBookedQuestion') }}</p>
      <div class="d-flex gap-2">
        <button type="button" class="btn btn-primary" :disabled="loadingBooking" @click="markAsBooked">
          <span v-if="loadingBooking" class="spinner-border spinner-border-sm me-1"></span>
          {{ t('csv.yes') }}
        </button>
        <button type="button" class="btn btn-light" :disabled="loadingBooking" @click="modal?.hideModal()">
          {{ t('csv.no') }}
        </button>
      </div>
    </div>
    <form v-else @submit.prevent="exportPackage">
      <div class="mb-3">
        <label for="booking-export-date" class="form-label">{{ t('labels.date') }}</label>
        <input id="booking-export-date" v-model="executionDate" type="date" class="form-control" required >
      </div>

      <div v-for="organisation in preview?.organisations" :key="organisation._id" class="border rounded p-3 mb-3">
        <div class="d-flex justify-content-between gap-3 mb-2">
          <strong>{{ organisation.name }}</strong>
          <span>{{ formatAmount(organisation.amount) }}</span>
        </div>
        <label class="form-label" :for="`booking-export-account-${organisation._id}`">{{ t('labels.payoutAccounts') }}</label>
        <select
          :id="`booking-export-account-${organisation._id}`"
          v-model="selections[organisation._id]"
          class="form-select"
          required>
          <option disabled value="">{{ t('labels.select') }}</option>
          <option v-for="account in organisation.accounts" :key="account._id" :value="account._id">
            {{ account.name }} · {{ account.maskedIban }}
          </option>
        </select>
      </div>

      <div v-if="preview?.errors.length" class="alert alert-danger">
        <div v-for="error in preview.errors" :key="error">{{ errorMessage(error) }}</div>
      </div>
      <p v-else-if="preview?.organisations.length === 0" class="text-body-secondary">{{ t('alerts.bookingExportNoPayments') }}</p>

      <div class="d-flex gap-2">
        <button type="submit" class="btn btn-primary" :disabled="loadingPackage || !canExport">
          <span v-if="loadingPackage" class="spinner-border spinner-border-sm me-1"></span>
          {{ t('labels.exportBookings') }}
        </button>
        <button type="button" class="btn btn-light" @click="modal?.hideModal()">{{ t('labels.cancel') }}</button>
      </div>
    </form>
  </ModalComponent>
</template>

<script lang="ts" setup>
import { BookingExportPackage, BookingExportPackageRequest, BookingExportPreview } from 'abrechnung-common/types.js'
import { computed, reactive, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import API from '@/api.js'
import ModalComponent from './ModalComponent.vue'

const props = defineProps<{ endpoint: string; reports: { _id: string }[] }>()
const emit = defineEmits<{ booked: [reportIds: string[]] }>()
const { t, locale } = useI18n()
const modal = useTemplateRef<InstanceType<typeof ModalComponent>>('modal')
const preview = ref<BookingExportPreview<string>>()
const executionDate = ref(today())
const selections = reactive<Record<string, string>>({})
const loadingPreview = ref(false)
const loadingPackage = ref(false)
const loadingBooking = ref(false)
const showBookingConfirmation = ref(false)
const exportedReportIds = ref<string[]>([])

const canExport = computed(
  () =>
    Boolean(preview.value) &&
    preview.value?.errors.length === 0 &&
    preview.value.organisations.every(({ _id }) => Boolean(selections[_id]))
)

function today() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

async function open() {
  loadingPreview.value = true
  preview.value = undefined
  for (const key of Object.keys(selections)) delete selections[key]
  showBookingConfirmation.value = false
  exportedReportIds.value = []
  modal.value?.modal?.show()
  const result = await API.setter<BookingExportPreview<string>>(
    `${props.endpoint}/bookingExportPreview`,
    props.reports.map(({ _id }) => _id),
    {},
    false
  )
  loadingPreview.value = false
  if (!result.ok) return
  preview.value = result.ok
  for (const organisation of result.ok.organisations) {
    if (organisation.accounts.length === 1) selections[organisation._id] = organisation.accounts[0]._id
  }
}

async function exportPackage() {
  if (!preview.value || !canExport.value) return
  loadingPackage.value = true
  const reportIds = props.reports.map(({ _id }) => _id)
  const body: BookingExportPackageRequest<string> = {
    reports: reportIds,
    executionDate: executionDate.value,
    bankAccounts: preview.value.organisations.map(({ _id }) => ({ organisation: _id, account: selections[_id] }))
  }
  const result = await API.setter<BookingExportPackage<string>>(`${props.endpoint}/bookingExportPackage`, body, {}, false)
  if (result.ok) {
    const { downloadBookingPackage } = await import('@/bookingPackage.js')
    downloadBookingPackage(result.ok, executionDate.value, t)
    exportedReportIds.value = reportIds
    showBookingConfirmation.value = true
  }
  loadingPackage.value = false
}

async function markAsBooked() {
  if (exportedReportIds.value.length === 0) return
  loadingBooking.value = true
  const result = await API.setter<{ status: 'fulfilled' | 'rejected' }[]>(
    `${props.endpoint}/booked`,
    exportedReportIds.value
  )
  loadingBooking.value = false
  if (!result.ok) return
  const bookedReportIds = exportedReportIds.value.filter((_, index) => result.ok?.[index]?.status === 'fulfilled')
  emit('booked', bookedReportIds)
  modal.value?.hideModal()
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat(locale.value, { style: 'currency', currency: 'EUR' }).format(amount)
}

function errorMessage(error: string) {
  const [code, organisation, account] = error.split(':')
  if (code === 'missingEmployeeBankAccount')
    return t('alerts.bookingExportMissingEmployeeBankAccount', { report: organisation })
  if (code === 'missingPayoutAccount')
    return t('alerts.bookingExportMissingPayoutAccount', { organisation })
  if (code === 'missingBankLedgerAccount')
    return t('alerts.bookingExportMissingBankLedgerAccount', { organisation, account })
  if (code === 'invalidPayoutAccount')
    return t('alerts.bookingExportInvalidPayoutAccount', { organisation, account })
  return error
}

defineExpose({ open })
</script>
