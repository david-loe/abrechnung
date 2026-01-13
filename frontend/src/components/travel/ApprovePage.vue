<template>
  <div>
    <ModalComponent
      :header="
        modalMode === 'approvedTravels'
          ? t('labels.approvedTravelReport')
          : modalTravel.state
          ? modalTravel.name
          : t('labels.newX', { X: t('labels.travel') })
      "
      ref="modalComp"
      @afterClose="modalMode === 'view' ? resetModal() : null">
      <template #header="{header}">
        <h5 class="modal-title">{{ header }}</h5>
        <RefStringBadge v-if="modalTravel.reference" class="ms-2" :number="modalTravel.reference" type="Travel" />
      </template>
      <div v-if="modalMode === 'approvedTravels'">
        <form
          @submit.prevent="
            showFile({
              endpoint: `approvedTravel/report`,
              params: {
                to: datetimeToDateString(approvedTravelsReportForm.to),
                from: datetimeToDateString(approvedTravelsReportForm.from),
                organisationId: approvedTravelsReportForm.organisation?._id
              },
              filename: `${encodeURIComponent(
                `${t('labels.travels')} ${datetimeToDateString(approvedTravelsReportForm.from)} - ${datetimeToDateString(
                  approvedTravelsReportForm.to
                )}`
              )}.pdf`,
              isDownloading: isDownloadingFn()
            })
          ">
          <div class="row mb-4 align-items-end">
            <div class="col-auto">
              <label for="fromDateInput" class="form-label">
                {{ t('labels.from') }}
                <span class="text-danger">*</span>
              </label>
              <DateInput id="fromDateInput" v-model="approvedTravelsReportForm.from" :required="true" />
            </div>
            <div class="col-auto">
              <label for="toDateInput" class="form-label">
                {{ t('labels.to') }}
                <span class="text-danger">*</span>
              </label>
              <DateInput id="toDateInput" v-model="approvedTravelsReportForm.to" :required="true" :min="approvedTravelsReportForm.from" />
            </div>
            <div v-if="APP_DATA && APP_DATA.organisations.length > 1" class="col-auto">
              <label for="organisationInput" class="form-label">{{ t('labels.organisation') }}</label>
              <OrganisationSelector id="organisationInput" v-model="approvedTravelsReportForm.organisation" />
            </div>
          </div>

          <button type="submit" class="btn btn-primary" :disabled="Boolean(isDownloading)">
            <span v-if="isDownloading" class="spinner-border spinner-border-sm"></span>
            <i v-else class="bi bi-file-earmark-pdf"></i>
            {{ t('labels.downloadX', { X: t('labels.approvedTravelReport') }) }}
          </button>
        </form>
      </div>
      <div v-else-if="modalTravel">
        <TravelApproveForm
          v-if="modalTravel.state === TravelState.APPLIED_FOR"
          :travel="(modalTravel as TravelSimple)"
          :loading="modalFormIsLoading"
          @cancel="resetAndHide()"
          @decision="(d, c) => approveTravel((modalTravel as TravelSimple)!, d, c)" />
        <TravelApply v-else-if="modalTravel.state === TravelState.APPROVED" :travel="(modalTravel as TravelSimple)" />
        <TravelApplyForm
          v-else-if="modalMode !== 'view'"
          :mode="modalMode"
          :travel="modalTravel"
          minStartDate=""
          createNotApply
          :loading="modalFormIsLoading"
          endpoint-prefix="examine/"
          @cancel="resetAndHide()"
          @add="(t) => approveTravel(t, 'approved')" />
      </div>
    </ModalComponent>
    <div class="container py-3">
      <div class="row mb-3 justify-content-end gx-4 gy-2">
        <div class="col-auto me-auto">
          <h2>{{ t('accesses.approve/travel') }}</h2>
        </div>
        <div class="col-auto">
          <button class="btn btn-secondary" @click="showModal('add', undefined)">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">{{ t('labels.createX', { X: t('labels.travel') }) }}</span>
          </button>
        </div>
      </div>
      <TravelList
        class="mb-5"
        ref="travelList"
        endpoint="approve/travel"
        :stateFilter="TravelState.APPLIED_FOR"
        :columns-to-hide="[
          'state',
          'editor',
          'addUp.totalTotal',
          'addUp.totalBalance',
          'updatedAt',
          'report',
          'organisation',
          'bookingRemark','addUp.totalAdvance', 'reference'
        ]"
        dbKeyPrefix="approve" />
      <button v-if="!show" type="button" class="btn btn-light" @click="show = TravelState.APPROVED">
        {{ t('labels.show') }}
        <StateBadge :state="TravelState.APPROVED" :StateEnum="TravelState" />
        <i class="bi bi-chevron-down"></i>
      </button>
      <template v-else>
        <button type="button" class="btn btn-light" @click="show = null">
          {{ t('labels.hide') }}
          <StateBadge :state="show" :StateEnum="TravelState" />
          <i class="bi bi-chevron-up"></i>
        </button>
        <button type="button" class="btn btn-light ms-4" @click="showModal('approvedTravels')">
          <i class="bi bi-file-earmark-pdf"></i>
          <span class="ms-1">{{ t('labels.approvedTravelReport') }}</span>
        </button>
        <hr class="hr" >
        <TravelList
          endpoint="approve/travel"
          :stateFilter="show"
          :columns-to-hide="['state', 'addUp.totalTotal', 'addUp.totalBalance', 'updatedAt', 'report', 'organisation', 'bookingRemark','addUp.totalAdvance', 'reference']"
          dbKeyPrefix="approved" />
      </template>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { OrganisationSimple, TravelSimple, TravelState } from 'abrechnung-common/types.js'
import { datetimeToDateString } from 'abrechnung-common/utils/scripts.js'
import { onMounted, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import API from '@/api.js'
import DateInput from '@/components/elements/DateInput.vue'
import ModalComponent from '@/components/elements/ModalComponent.vue'
import RefStringBadge from '@/components/elements/RefStringBadge.vue'
import StateBadge from '@/components/elements/StateBadge.vue'
import TravelApply from '@/components/travel/elements/TravelApplication.vue'
import TravelApplyForm from '@/components/travel/forms/TravelApplyForm.vue'
import TravelApproveForm from '@/components/travel/forms/TravelApproveForm.vue'
import TravelList from '@/components/travel/TravelList.vue'
import APP_LOADER from '@/dataLoader.js'
import { showFile } from '@/helper.js'
import OrganisationSelector from '../elements/OrganisationSelector.vue'

const props = defineProps<{ _id?: string }>()
const router = useRouter()
const { t } = useI18n()

type ModalMode = 'view' | 'add' | 'approvedTravels'

const modalTravel = ref<Partial<TravelSimple<string>>>({})
const approvedTravelsReportForm = ref({
  from: new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)),
  to: new Date(Date.UTC(new Date().getUTCFullYear(), 11, 31)),
  organisation: null as null | OrganisationSimple<string>
})
const modalMode = ref<ModalMode>('view')
const show = ref<null | TravelState.APPROVED>(null)
const modalFormIsLoading = ref(false)

const modalComp = useTemplateRef('modalComp')
const travelList = useTemplateRef('travelList')

const isDownloading = ref('')
const isDownloadingFn = () => isDownloading

await APP_LOADER.loadData()
const APP_DATA = APP_LOADER.data

function showModal(mode: ModalMode, travel?: Partial<TravelSimple<string>>) {
  if (travel) {
    modalTravel.value = travel
  }
  modalMode.value = mode
  if (modalComp.value?.modal) {
    modalComp.value.modal.show()
  }
}

function hideModal() {
  modalComp.value?.hideModal()
}
function resetModal() {
  modalTravel.value = {}
  modalMode.value = 'view'
  router.push('/approve/travel')
}
function resetAndHide() {
  resetModal()
  hideModal()
}

async function approveTravel(travel: Partial<TravelSimple>, decision: 'approved' | 'rejected', comment?: string) {
  if (travel) {
    travel.comment = comment
    modalFormIsLoading.value = true
    const result = await API.setter<TravelSimple>(`approve/travel/${decision}`, travel)
    modalFormIsLoading.value = false
    if (result.ok) {
      travelList.value?.loadFromServer()
      resetAndHide()
    }
  }
}
async function showTravel(_id: string) {
  const result = await API.getter<TravelSimple<string>>('approve/travel', { _id })
  if (result.ok) {
    showModal('view', result.ok.data)
  }
}
onMounted(() => {
  if (props._id) {
    showTravel(props._id)
  }
})
watch(
  () => props._id,
  (value) => {
    if (value) {
      showTravel(value)
    }
  }
)
</script>

<style></style>
