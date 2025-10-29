<template>
  <div v-if="APP_DATA">
    <ModalComponent
      ref="modalComp"
      :header="
        modalMode === 'add'
          ? t('labels.newX', { X: t('labels.' + modalObjectType) })
          : t('labels.editX', { X: t('labels.' + modalObjectType) })
      "
      @afterClose="modalMode === 'edit' ? resetModal() : null">
      <div v-if="travel._id">
        <ErrorBanner :error="error"></ErrorBanner>
        <StageForm
          v-if="modalObjectType === 'stage'"
          :mode="modalMode"
          :stage="(modalObject as Partial<Stage<string>> | Gap | undefined)"
          :travelStartDate="travel.startDate"
          :travelEndDate="travel.endDate"
          :disabled="isReadOnly"
          :loading="modalFormIsLoading"
          :vehicleRegistration="
            endpointPrefix !== 'examine/' && travel.state === TravelState.APPROVED ? APP_DATA.user.vehicleRegistration : null
          "
          :travelSettings="APP_DATA.travelSettings"
          :endpointPrefix="endpointPrefix"
          :ownerId="endpointPrefix === 'examine/' ? travel.owner._id : undefined"
          :show-next-button="modalMode === 'edit' && Boolean(tableRef?.getNext((modalObject as Stage), modalObjectType))"
          :show-prev-button="modalMode === 'edit' && Boolean(tableRef?.getPrev((modalObject as Stage), modalObjectType))"
          @add="postStage"
          @edit="postStage"
          @deleted="deleteStage"
          @cancel="resetAndHide"
          @update:vehicleRegistration="postVehicleRegistration"
          @next="() => {const next = tableRef?.getNext((modalObject as Stage), 'stage'); if(next){showModal('edit', next.type, next.data)}else{hideModal()}}"
          @prev="() => {const prev = tableRef?.getPrev((modalObject as Stage), 'stage'); if(prev){showModal('edit', prev.type, prev.data)}else{hideModal()}}">
        </StageForm>
        <ExpenseForm
          v-else-if="modalObjectType === 'expense'"
          :expense="(modalObject as Partial<TravelExpense<string>> | undefined)"
          :disabled="isReadOnly"
          :loading="modalFormIsLoading"
          :mode="modalMode"
          :endpointPrefix="endpointPrefix"
          :ownerId="endpointPrefix === 'examine/' ? travel.owner._id : undefined"
          :show-next-button="modalMode === 'edit' && Boolean(tableRef?.getNext((modalObject as TravelExpense), modalObjectType))"
          :show-prev-button="modalMode === 'edit' && Boolean(tableRef?.getPrev((modalObject as TravelExpense), modalObjectType))"
          @add="postExpense"
          @edit="postExpense"
          @deleted="deleteExpense"
          @cancel="resetAndHide"
          @next="() => {const next = tableRef?.getNext((modalObject as TravelExpense), 'expense'); if(next){showModal('edit', next.type, next.data)}else{hideModal()}}"
          @prev="() => {const prev = tableRef?.getPrev((modalObject as TravelExpense), 'expense'); if(prev){showModal('edit', prev.type, prev.data)}else{hideModal()}}">
        </ExpenseForm>
        <TravelApplyForm
          v-else-if="modalObjectType === 'travel'"
          :mode="modalMode"
          :travel="(modalObject as TravelSimple<string>)"
          :minStartDate="endpointPrefix === 'examine/' ? travel.startDate : APP_DATA?.user.access['approved:travel'] ? '' : undefined"
          :createNotApply="APP_DATA?.user.access['approved:travel']"
          :loading="modalFormIsLoading"
          :owner="travel.owner"
          :update-user-org="endpointPrefix !== 'examine/'"
          :endpoint-prefix="endpointPrefix"
          @cancel="resetAndHide"
          @edit="editTravelDetails">
        </TravelApplyForm>
        <LumpSumEditor
          v-else-if="modalObjectType === 'lumpSums'"
          :travel="travel"
          :loading="modalFormIsLoading"
          :disabled="isReadOnly"
          :travelSettings="APP_DATA.travelSettings"
          :travelCalculator="APP_DATA.travelCalculator"
          @save="postLumpSums"
          @cancel="resetAndHide"></LumpSumEditor>
      </div>
    </ModalComponent>
    <div class="container py-3" v-if="travel._id">
      <div class="row">
        <div class="col">
          <nav v-if="parentPages && parentPages.length > 0" aria-label="breadcrumb">
            <ol class="breadcrumb">
              <li class="breadcrumb-item" v-for="page of parentPages" :key="page.link">
                <router-link :to="page.link">{{ t(page.title) }}</router-link>
              </li>
              <li class="breadcrumb-item active" aria-current="page">{{ travel.name }}</li>
            </ol>
          </nav>
        </div>
        <div class="col-auto">
          <HelpButton :examinerMails="examinerMails" />
        </div>
      </div>

      <div class="mb-2">
        <div class="row justify-content-between align-items-end">
          <div class="col-auto">
            <h2 class="m-0">{{ travel.name }}</h2>
          </div>
          <div class="col">
            <h4 class="text-secondary m-0">
              {{ formatter.simpleDate(travel.startDate) + ' - ' + formatter.simpleDate(travel.endDate) }}
            </h4>
          </div>
          <div class="col-auto">
            <div class="dropdown">
              <a class="nav-link link-body-emphasis" data-bs-toggle="dropdown" data-bs-auto-close="outside" href="#" role="button">
                <i class="bi bi-three-dots-vertical fs-3"></i>
              </a>
              <ul class="dropdown-menu dropdown-menu-end">
                <template v-if="endpointPrefix === 'examine/' && travel.state < State.BOOKABLE">
                  <li>
                    <div class="ps-3">
                      <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" role="switch" id="editTravel" v-model="isReadOnlySwitchOn" />
                        <label class="form-check-label text-nowrap" for="editTravel">
                          <span class="me-1"><i class="bi bi-lock"></i></span>
                          <span>{{ t('labels.readOnly') }}</span>
                        </label>
                      </div>
                    </div>
                  </li>
                  <li>
                    <hr class="dropdown-divider" />
                  </li>
                </template>
                <li>
                  <a :class="'dropdown-item' + (isReadOnly ? ' disabled' : '')" href="#" @click="showModal('edit', 'travel', travel)">
                    <span class="me-1"><i class="bi bi-pencil"></i></span>
                    <span>{{ t('labels.editX', { X: t('labels.XDetails', { X: t('labels.travel') }) }) }}</span>
                  </a>
                </li>
                <li>
                  <a
                    :class="
                      'dropdown-item' + (isReadOnly && endpointPrefix === 'examine/' && travel.state < State.BOOKABLE ? ' disabled' : '')
                    "
                    href="#"
                    @click="isReadOnly && endpointPrefix === 'examine/' && travel.state < State.BOOKABLE ? null : deleteTravel()">
                    <span class="me-1"><i class="bi bi-trash"></i></span>
                    <span>{{ t('labels.delete') }}</span>
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div class="text-secondary">
          {{
            (endpointPrefix === 'examine/' ? formatter.name(travel.owner.name) + ' - ' : '') +
            travel.project.identifier +
            (travel.project.name ? ' ' + travel.project.name : '')
          }}
        </div>
      </div>

      <StatePipeline class="mb-3" :state="travel.state" :StateEnum="TravelState"></StatePipeline>

      <div class="row row justify-content-between">
        <div class="col-lg-auto col-12">
          <div class="row g-1 mb-4">
            <div class="col-auto">
              <button class="btn btn-secondary" @click="isReadOnly ? null : showModal('add', 'stage', undefined)" :disabled="isReadOnly">
                <i class="bi bi-plus-lg"></i>
                <span class="ms-1 d-none d-md-inline">{{ t('labels.addX', { X: t('labels.stage') }) }}</span>
                <span class="ms-1 d-md-none">{{ t('labels.stage') }}</span>
              </button>
            </div>
            <div class="col-auto">
              <button class="btn btn-secondary" @click="isReadOnly ? null : showModal('add', 'expense', undefined)" :disabled="isReadOnly">
                <i class="bi bi-plus-lg"></i>
                <span class="ms-1 d-none d-md-inline">{{ t('labels.addX', { X: t('labels.expense') }) }}</span>
                <span class="ms-1 d-md-none">{{ t('labels.expense') }}</span>
              </button>
            </div>
            <div class="col-auto">
              <button
                class="btn btn-outline-secondary"
                @click="travel.days.length < 1 ? null : showModal('edit', 'lumpSums', undefined)"
                :disabled="travel.days.length < 1">
                <span class="ms-1 d-none d-md-inline">{{ t('labels.editX', { X: t('labels.lumpSums') }) }}</span>
                <span class="ms-1 d-md-none">{{ t('labels.lumpSums') }}</span>
              </button>
            </div>
          </div>

          <div v-if="travel.stages.length == 0" class="alert alert-light" role="alert">
            {{ t('alerts.noData.stage') }}
          </div>
          <TravelTable :travel="travel" ref="table" @showModal="showModal" />
        </div>

        <div class="col-lg-4 col">
          <div class="card">
            <div class="card-body">
              <h5 class="card-title">{{ t('labels.summary') }}</h5>
              <div>
                <AddUpTable
                  :add-up="travel.addUp"
                  :claim-spouse-refund="travel.claimSpouseRefund"
                  :progress="travel.progress"
                  :project="travel.project"
                  withLumpSums
                  :showAdvanceOverflow="travel.state < State.BOOKABLE"></AddUpTable>
                <div v-if="travel.comments.length > 0" class="mb-3 p-2 pb-0 bg-light-subtle">
                  <small>
                    <p v-for="comment of travel.comments" :key="comment._id">
                      <span class="fw-bold">{{ comment.author.name.givenName + ': ' }}</span>
                      <span>{{ comment.text }}</span>
                    </p>
                  </small>
                </div>
                <div v-if="travel.state < State.BOOKABLE" class="mb-3">
                  <label for="comment" class="form-label">{{ t('labels.comment') }}</label>
                  <TextArea
                    id="comment"
                    v-model="travel.comment"
                    :disabled="isReadOnly && !(endpointPrefix === 'examine/' && travel.state === State.IN_REVIEW)"></TextArea>
                </div>
                <div v-if="endpointPrefix === 'examine/'" class="mb-3">
                  <label for="bookingRemark" class="form-label">{{ t('labels.bookingRemark') }}</label>
                  <TextArea
                    id="bookingRemark"
                    v-model="travel.bookingRemark"
                    :disabled="isReadOnly && !(endpointPrefix === 'examine/' && travel.state === State.IN_REVIEW)"></TextArea>
                </div>
                <template v-if="travel.state < State.BOOKABLE">
                  <div v-if="travel.state === TravelState.APPROVED">
                    <TooltipElement v-if="travel.stages.length < 1" :text="t('alerts.noData.stage')">
                      <button class="btn btn-primary" disabled>
                        <i class="bi bi-pencil-square"></i>
                        <span class="ms-1">{{ t('labels.toExamination') }}</span>
                      </button>
                    </TooltipElement>
                    <button v-else @click="isReadOnly ? null : toExamination()" class="btn btn-primary" :disabled="isReadOnly">
                      <i class="bi bi-pencil-square"></i>
                      <span class="ms-1">{{ t('labels.toExamination') }}</span>
                    </button>
                  </div>
                  <template v-else-if="travel.state === State.IN_REVIEW">
                    <div v-if="endpointPrefix === 'examine/'" class="mb-3">
                      <button class="btn btn-success" @click="completeReview()">
                        <i class="bi bi-check2-square"></i>
                        <span class="ms-1">{{ t('labels.completeReview') }}</span>
                      </button>
                    </div>
                    <div>
                      <button
                        class="btn btn-secondary"
                        @click="travel.editor._id !== travel.owner._id && endpointPrefix !== 'examine/' ? null : backToApproved()"
                        :disabled="travel.editor._id !== travel.owner._id && endpointPrefix !== 'examine/'">
                        <i class="bi bi-arrow-counterclockwise"></i>
                        <span class="ms-1">{{ t(endpointPrefix === 'examine/' ? 'labels.backToApplicant' : 'labels.editAgain') }}</span>
                      </button>
                    </div>
                  </template>
                </template>
                <div v-else>
                  <button
                    class="btn btn-primary"
                    @click="
                      showFile({
                        endpoint: `${props.endpointPrefix}travel/report`,
                        params: { _id: travel._id },
                        filename: `${travel.name}.pdf`,
                        isDownloading: isDownloadingFn()
                      })
                    "
                    :title="t('labels.report')"
                    :disabled="Boolean(isDownloading)">
                    <span v-if="isDownloading" class="spinner-border spinner-border-sm"></span>
                    <i v-else class="bi bi-file-earmark-pdf"></i>
                    <span class="ms-1">{{ t('labels.showX', { X: t('labels.report') }) }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import {
  DocumentFile,
  Place,
  Stage,
  State,
  Travel,
  TravelDay,
  TravelExpense,
  TravelRecord,
  TravelRecordType,
  TravelSimple,
  TravelState,
  User,
  UserSimple
} from 'abrechnung-common/types.js'
import type { PropType } from 'vue'
import { computed, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import API from '@/api.js'
import AddUpTable from '@/components/elements/AddUpTable.vue'
import ErrorBanner, { RequestError } from '@/components/elements/ErrorBanner.vue'
import HelpButton from '@/components/elements/HelpButton.vue'
import ModalComponent from '@/components/elements/ModalComponent.vue'
import StatePipeline from '@/components/elements/StatePipeline.vue'
import TextArea from '@/components/elements/TextArea.vue'
import TooltipElement from '@/components/elements/TooltipElement.vue'
import LumpSumEditor from '@/components/travel//elements/LumpSumEditor.vue'
import TravelTable from '@/components/travel//elements/TravelTable.vue'
import ExpenseForm from '@/components/travel/forms/ExpenseForm.vue'
import StageForm from '@/components/travel/forms/StageForm.vue'
import TravelApplyForm from '@/components/travel/forms/TravelApplyForm.vue'
import APP_LOADER from '@/dataLoader.js'
import { formatter } from '@/formatter.js'
import { showFile } from '@/helper.js'
import { logger } from '@/logger.js'

type Gap = { departure: Stage['arrival']; startLocation: Stage['endLocation'] }
type ModalMode = 'add' | 'edit'
type ModalObject = Partial<TravelRecord> | Partial<TravelSimple> | Gap
type ModalObjectType = TravelRecordType | 'travel' | 'lumpSums'

const props = defineProps({
  _id: { type: String, required: true },
  parentPages: { type: Array as PropType<{ link: string; title: string }[]>, required: true },
  endpointPrefix: { type: String, default: '' }
})

const router = useRouter()
const { t } = useI18n()

const travel = ref<Travel<string>>({} as Travel<string>)
const modalObject = ref<ModalObject>({})
const modalMode = ref<ModalMode>('add')
const modalObjectType = ref<ModalObjectType>('stage')
const error = ref<RequestError | undefined>(undefined)
const isReadOnlySwitchOn = ref(true)
const modalFormIsLoading = ref(false)

const isDownloading = ref('')
const isDownloadingFn = () => isDownloading

const modalCompRef = useTemplateRef('modalComp')
const tableRef = useTemplateRef('table')

await APP_LOADER.loadData()
const APP_DATA = APP_LOADER.data

const isReadOnly = computed(() => {
  return (
    (travel.value.state > State.EDITABLE_BY_OWNER ||
      (travel.value.state === State.EDITABLE_BY_OWNER && props.endpointPrefix === 'examine/')) &&
    isReadOnlySwitchOn.value
  )
})

function showModal(mode: ModalMode, type: ModalObjectType, object?: ModalObject) {
  if (object) {
    modalObject.value = object
  } else if (modalObjectType.value !== type) {
    modalObject.value = {}
  }
  modalObjectType.value = type
  modalMode.value = mode
  if (modalCompRef.value?.modal) {
    modalCompRef.value.modal.show()
  }
}

function hideModal() {
  modalCompRef.value?.hideModal()
}

function resetModal() {
  modalMode.value = 'add'
  modalObject.value = {}
}
function resetAndHide() {
  resetModal()
  hideModal()
}

async function postLumpSums(days: TravelDay[], lastPlaceOfWork: Travel['lastPlaceOfWork']) {
  const travelObj = { _id: travel.value._id, lastPlaceOfWork, days }
  modalFormIsLoading.value = true
  const result = await API.setter<Travel<string>>(`${props.endpointPrefix}travel`, travelObj)
  modalFormIsLoading.value = false
  if (result.ok) {
    setTravel(result.ok)
    resetAndHide()
  } else {
    await getTravel()
  }
}

async function editTravelDetails(updatedTravel: Partial<TravelSimple>) {
  if (props.endpointPrefix === 'examine/' || APP_DATA.value?.user.access['approved:travel']) {
    modalFormIsLoading.value = true
    const path = props.endpointPrefix === 'examine/' ? 'examine/travel' : 'travel/approved'
    const result = await API.setter<Travel<string>>(path, updatedTravel)
    modalFormIsLoading.value = false
    if (result.ok) {
      setTravel(result.ok)
      resetAndHide()
    } else {
      await getTravel()
    }
  } else {
    if (confirm(t('alerts.warningReapply'))) {
      modalFormIsLoading.value = true
      const result = await API.setter<Travel>('travel/appliedFor', updatedTravel)
      modalFormIsLoading.value = false
      if (result.ok) {
        resetAndHide()
        router.push({ path: '/' })
      } else {
        await getTravel()
      }
    }
  }
}

async function deleteTravel() {
  modalFormIsLoading.value = true
  const result = await API.deleter(`${props.endpointPrefix}travel`, { _id: props._id })
  modalFormIsLoading.value = false
  if (result) {
    router.push({ path: '/' })
  }
}

async function toExamination() {
  modalFormIsLoading.value = true
  const result = await API.setter<Travel>(`${props.endpointPrefix}travel/underExamination`, {
    _id: travel.value._id,
    comment: travel.value.comment
  })
  modalFormIsLoading.value = false
  if (result.ok) {
    router.push({ path: '/' })
  }
}

async function backToApproved() {
  const result = await API.setter<Travel<string>>(`${props.endpointPrefix}travel/approved`, {
    _id: travel.value._id,
    comment: travel.value.comment
  })
  if (result.ok) {
    if (props.endpointPrefix === 'examine/') {
      router.push({ path: '/examine/travel' })
    } else {
      setTravel(result.ok)
    }
  }
}

async function completeReview() {
  if (confirm(t('alerts.areYouSureCompleteReview'))) {
    const result = await API.setter<Travel<string>>('examine/travel/reviewCompleted', {
      _id: travel.value._id,
      comment: travel.value.comment,
      bookingRemark: travel.value.bookingRemark
    })
    if (result.ok) {
      setTravel(result.ok)
    }
  }
}

async function postStage(stage: Partial<Stage>) {
  let headers: { 'Content-Type'?: string } = {}
  if (stage.cost) {
    if (stage.cost.receipts) {
      headers = { 'Content-Type': 'multipart/form-data' }
    }
    if ((stage.cost.amount as unknown) === '') {
      stage.cost.amount = 0
    }
  }
  modalFormIsLoading.value = true
  const result = await API.setter<Travel<string>>(`${props.endpointPrefix}travel/stage`, stage, {
    headers,
    params: { parentId: travel.value._id }
  })
  modalFormIsLoading.value = false
  if (result.ok) {
    setTravel(result.ok)
    resetAndHide()
  } else if (result.error) {
    if (typeof result.error === 'object' && 'message' in result.error && typeof result.error.message === 'string') {
      error.value = { ...result.error, message: result.error.message }
    }
    const modalEl = document.getElementById('modal')
    if (modalEl) {
      modalEl.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }
}

async function deleteStage(_id?: string) {
  if (_id) {
    modalFormIsLoading.value = true
    const result = await API.deleter(`${props.endpointPrefix}travel/stage`, { _id, parentId: props._id })
    modalFormIsLoading.value = false
    if (result) {
      setTravel(result as Travel<string>)
      resetAndHide()
    }
  }
}

async function postExpense(expense: Partial<TravelExpense>) {
  let headers: { 'Content-Type'?: string } = {}
  if (expense.cost?.receipts) {
    headers = { 'Content-Type': 'multipart/form-data' }
  }
  modalFormIsLoading.value = true
  const result = await API.setter<Travel<string>>(`${props.endpointPrefix}travel/expense`, expense, {
    headers,
    params: { parentId: travel.value._id }
  })
  modalFormIsLoading.value = false
  if (result.ok) {
    setTravel(result.ok)
    resetAndHide()
  }
}

async function deleteExpense(_id?: string) {
  if (_id) {
    modalFormIsLoading.value = true
    const result = await API.deleter(`${props.endpointPrefix}travel/expense`, { _id, parentId: props._id })
    modalFormIsLoading.value = false
    if (result) {
      setTravel(result as Travel<string>)
      resetAndHide()
    }
  }
}

async function postVehicleRegistration(vehicleRegistration: DocumentFile[]) {
  const result = await API.setter<User<string>>(
    `${props.endpointPrefix}user/vehicleRegistration`,
    { vehicleRegistration },
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
  if (result.ok && APP_DATA.value) {
    APP_DATA.value.user = result.ok
  }
}

async function getTravel() {
  const params = { _id: props._id, additionalFields: ['stages', 'expenses', 'days'] }
  const res = (await API.getter<Travel<string>>(`${props.endpointPrefix}travel`, params)).ok
  if (res) {
    setTravel(res.data)
  }
}

function setTravel(newTravel: Travel<string>) {
  travel.value = newTravel
  logger.info(`${t('labels.travel')}:`)
  logger.info(travel.value)
}

async function getExaminerMails(): Promise<string[]> {
  const result = (await API.getter<UserSimple[]>('travel/examiner')).ok
  if (result) {
    return result.data.map((x) => x.email)
  }
  return []
}

try {
  await getTravel()
} catch (e) {
  router.push({ path: props.parentPages[props.parentPages.length - 1].link })
}
const examinerMails = await getExaminerMails()
</script>

<style></style>
