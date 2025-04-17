<template>
  <div>
    <ModalComponent
      ref="modalComp"
      :header="
        modalMode === 'add'
          ? t('labels.newX', { X: t('labels.' + modalObjectType) })
          : t('labels.editX', { X: t('labels.' + modalObjectType) })
      "
      @beforeClose="modalMode === 'edit' ? resetModal() : null">
      <div v-if="travel._id">
        <ErrorBanner :error="error"></ErrorBanner>
        <StageForm
          v-if="modalObjectType === 'stage'"
          :mode="modalMode"
          :stage="(modalObject as Partial<Stage> | Gap | undefined)"
          :travelStartDate="travel.startDate"
          :travelEndDate="travel.endDate"
          :disabled="isReadOnly"
          :loading="modalFormIsLoading"
          :showVehicleRegistration="travel.state === 'approved'"
          :endpointPrefix="endpointPrefix"
          :ownerId="endpointPrefix === 'examine/' ? travel.owner._id : undefined"
          :show-next-button="modalMode === 'edit' && Boolean(getNext((modalObject as Stage), modalObjectType))"
          :show-prev-button="modalMode === 'edit' && Boolean(getPrev((modalObject as Stage), modalObjectType))"
          @add="postStage"
          @edit="postStage"
          @deleted="deleteStage"
          @cancel="resetAndHide"
          @postVehicleRegistration="postVehicleRegistration"
          @next="() => {const next = getNext((modalObject as Stage), 'stage'); if(next){showModal('edit', next.type, next.data)}else{hideModal()}}"
          @prev="() => {const prev = getPrev((modalObject as Stage), 'stage'); if(prev){showModal('edit', prev.type, prev.data)}else{hideModal()}}">
        </StageForm>
        <ExpenseForm
          v-else-if="modalObjectType === 'expense'"
          :expense="(modalObject as Partial<TravelExpense> | undefined)"
          :disabled="isReadOnly"
          :loading="modalFormIsLoading"
          :mode="modalMode"
          :endpointPrefix="endpointPrefix"
          :ownerId="endpointPrefix === 'examine/' ? travel.owner._id : undefined"
          :show-next-button="modalMode === 'edit' && Boolean(getNext((modalObject as TravelExpense), modalObjectType))"
          :show-prev-button="modalMode === 'edit' && Boolean(getPrev((modalObject as TravelExpense), modalObjectType))"
          @add="postExpense"
          @edit="postExpense"
          @deleted="deleteExpense"
          @cancel="resetAndHide"
          @next="() => {const next = getNext((modalObject as TravelExpense), 'expense'); if(next){showModal('edit', next.type, next.data)}else{hideModal()}}"
          @prev="() => {const prev = getPrev((modalObject as TravelExpense), 'expense'); if(prev){showModal('edit', prev.type, prev.data)}else{hideModal()}}">
        </ExpenseForm>
        <TravelApplyForm
          v-else-if="modalObjectType === 'travel'"
          :mode="modalMode"
          :travel="(modalObject as TravelSimple)"
          :minStartDate="endpointPrefix === 'examine/' ? travel.startDate : undefined"
          :loading="modalFormIsLoading"
          @cancel="resetAndHide"
          @edit="editTravelDetails">
        </TravelApplyForm>
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
          <div class="dropdown">
            <button type="button" class="btn btn-outline-info" data-bs-toggle="dropdown" aria-expanded="false">
              {{ t('labels.help') }}
            </button>
            <ul class="dropdown-menu dropdown-menu-end">
              <li>
                <a class="dropdown-item" :href="mailToLinkVal"><i class="bi bi-envelope-fill me-1"></i>Mail</a>
              </li>
              <li>
                <a class="dropdown-item" :href="msTeamsToLinkVal" target="_blank"><i class="bi bi-microsoft-teams me-1"></i>Teams</a>
              </li>
            </ul>
          </div>
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
                <template v-if="endpointPrefix === 'examine/' && travel.state !== 'refunded'">
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
                    <span>{{ t('labels.editX', { X: t('labels.travelDetails') }) }}</span>
                  </a>
                </li>
                <li>
                  <a
                    :class="
                      'dropdown-item' + (isReadOnly && endpointPrefix === 'examine/' && travel.state !== 'refunded' ? ' disabled' : '')
                    "
                    href="#"
                    @click="isReadOnly && endpointPrefix === 'examine/' && travel.state !== 'refunded' ? null : deleteTravel()">
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
            (endpointPrefix === 'examine/' ? travel.owner.name.givenName + ' ' + travel.owner.name.familyName + ' - ' : '') +
            travel.project.identifier +
            (travel.project.name ? ' ' + travel.project.name : '')
          }}
        </div>
      </div>

      <StatePipeline class="mb-3" :state="travel.state" :states="travelStates"></StatePipeline>

      <div class="row gx-5 justify-content-center align-items-center mb-5">
        <div class="col-auto">
          <div class="form-check form-switch">
            <input
              class="form-check-input"
              type="checkbox"
              role="switch"
              id="travelClaimOvernightLumpSum"
              v-model="travel.claimOvernightLumpSum"
              @change="postTravelSettings"
              :disabled="isReadOnly" />
            <label class="form-check-label" for="travelClaimOvernightLumpSum">{{ t('labels.claimOvernightLumpSum') }}</label>
            <InfoPoint class="ms-1" :text="t('info.claimOvernightLumpSum')" />
          </div>
        </div>
        <div class="col-auto">
          <div class="row align-items-center">
            <div class="col-auto pe-2">
              <label class="form-label mb-0">{{ t('labels.lastPlaceOfWork') }}</label>
            </div>
            <div class="col-auto p-0">
              <select
                class="form-select form-select-sm"
                @change="postTravelSettings"
                v-model="travel.lastPlaceOfWork"
                :disabled="isReadOnly">
                <option v-for="place of getLastPaceOfWorkList(travel)" :value="place" :key="place.country._id + place.special">
                  <PlaceElement :place="place" :showPlace="false" :showSpecial="true"></PlaceElement>
                </option>
              </select>
            </div>
            <div class="col-auto ps-2">
              <InfoPoint :text="t('info.lastPlaceOfWork')" />
            </div>
          </div>
        </div>
        <div v-if="travel.stages.length > 0 && travel.professionalShare !== null && travel.professionalShare !== 1" class="col-auto">
          <label class="form-check-label me-2" for="travelProfessionalShare">
            {{ t('labels.professionalShare') + ':' }}
          </label>
          <span
            id="travelProfessionalShare"
            :class="travel.professionalShare <= APP_DATA!.travelSettings.minProfessionalShare ? 'text-danger' : ''">
            {{ Math.round(travel.professionalShare * 100) + '%' }}</span
          >
          <InfoPoint class="ms-1" :text="t('info.professionalShare')" />
        </div>
      </div>

      <div class="row row justify-content-between">
        <div class="col-lg-auto col-12">
          <div class="row g-1 mb-2">
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
          </div>
          <div class="row mb-2">
            <div class="col-auto">
              <button
                class="btn btn-link btn-sm"
                @click="travel.days.map((d) => ((d as Day).showSettings = true))"
                :disabled="travel.stages.length == 0">
                {{ t('labels.expandAll') }}
                <i class="bi bi-arrows-expand"></i>
              </button>
            </div>
            <div class="col-auto">
              <button
                class="btn btn-link btn-sm"
                @click="travel.days.map((d) => ((d as Day).showSettings = false))"
                :disabled="travel.stages.length == 0">
                {{ t('labels.collapseAll') }}
                <i class="bi bi-arrows-collapse"></i>
              </button>
            </div>
          </div>
          <div v-if="travel.stages.length == 0" class="alert alert-light" role="alert">
            {{ t('alerts.noData.stage') }}
          </div>

          <div
            v-for="row of table"
            class="mb-2"
            :key="row.type === 'gap' ? (row.data as Gap).departure.toString() : (row.data as TravelRecord | Day)._id">
            <!-- day -->
            <div v-if="row.type === 'day'" class="row align-items-center mt-3">
              <div class="col-auto">
                <h5 class="m-0">
                  <small
                    v-if="(row.data as Day).purpose === 'private'"
                    :title="t('labels.private')"
                    style="margin-left: -1.25rem; margin-right: 0.156rem">
                    <i class="bi bi-file-person"></i> </small
                  >{{ formatter.simpleDate((row.data as Day).date) }}
                </h5>
              </div>
              <div class="col">
                <div class="row align-items-center">
                  <!-- refunds -->
                  <template v-if="!(row.data as Day).showSettings">
                    <template v-for="refund of (row.data as Day).refunds" :key="refund._id">
                      <!-- catering -->
                      <div
                        v-if="refund.type.indexOf('catering') == 0"
                        class="col-auto text-secondary"
                        :title="
                          (travel.claimSpouseRefund ? '2x ' : '') +
                          t('lumpSums.' + refund.type) +
                          ' ' +
                          (row.data as Day).country.flag +
                          ((row.data as Day).special ? ' (' + (row.data as Day).special + ')' : '')
                        ">
                        <i class="bi bi-sun"></i>
                        {{ formatter.money(refund.refund) }}
                      </div>
                      <!-- overnight -->
                      <div
                        v-else
                        class="col-auto text-secondary"
                        :title="
                          (travel.claimSpouseRefund ? '2x ' : '') +
                          t('lumpSums.' + refund.type) +
                          ' ' +
                          (row.data as Day).country.flag +
                          ((row.data as Day).special ? ' (' + (row.data as Day).special + ')' : '')
                        ">
                        <i class="bi bi-moon"></i>
                        {{ formatter.money(refund.refund) }}
                      </div>
                    </template>
                  </template>
                  <template v-else>
                    <div class="col-auto pe-1">
                      <InfoPoint :text="t('info.cateringNoRefund')" />
                    </div>
                    <div v-for="key of meals" class="form-check col-auto" :key="key">
                      <input
                        class="form-check-input"
                        type="checkbox"
                        role="switch"
                        :id="'configCateringRefund' + key + (row.data as Day).date"
                        v-model="((row.data as Day).cateringNoRefund as any)[key]"
                        @change="isReadOnly ? null : postTravelSettings()"
                        :disabled="isReadOnly" />
                      <label class="form-check-label" :for="'configCateringRefund' + key + (row.data as Day).date">
                        {{ t('labels.' + key) }}
                      </label>
                    </div>
                    <div class="col-auto">
                      <div class="row align-items-center">
                        <div class="col-auto pe-1">
                          <InfoPoint :text="t('info.purpose')" />
                        </div>
                        <div class="col-auto ps-0">
                          <select
                            class="form-select form-select-sm"
                            v-model="(row.data as Day).purpose"
                            @change="isReadOnly ? null : postTravelSettings()"
                            :disabled="isReadOnly"
                            required>
                            <option v-for="purpose of ['professional', 'private']" :value="purpose" :key="purpose">
                              {{ t('labels.' + purpose) }}
                            </option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </template>
                </div>
              </div>
              <div class="col-auto ms-auto">
                <i
                  :class="(row.data as Day).showSettings ? 'bi bi-x-lg' : 'bi bi-sliders'"
                  style="cursor: pointer"
                  @click=";(row.data as Day).showSettings = !(row.data as Day).showSettings"></i>
              </div>
            </div>
            <!-- Stage -->
            <div
              v-else-if="row.type === 'stage'"
              class="row align-items-center ps-lg-4 mb-1"
              style="cursor: pointer"
              @click="showModal('edit', 'stage', row.data as Stage)">
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
              class="row align-items-center ps-lg-4 mb-1"
              style="cursor: pointer"
              @click="showModal('edit', 'expense', row.data as TravelExpense)">
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
                <button class="btn btn-sm btn-light" @click="showModal('add', 'stage', row.data as Gap)" style="border-radius: 50%">
                  <i class="bi bi-plus-lg"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="col-lg-3 col">
          <div class="card">
            <div class="card-body">
              <h5 class="card-title">{{ t('labels.summary') }}</h5>
              <div>
                <table class="table align-bottom">
                  <tbody>
                    <tr>
                      <th>{{ t('labels.progress') }}</th>
                      <td class="text-end">
                        <ProgressCircle :progress="travel.progress"></ProgressCircle>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <small>
                          {{ t('labels.lumpSums') }}
                          <small v-if="travel.claimSpouseRefund">
                            <br />
                            {{ t('labels.includingSpouseRefund') }}
                          </small>
                        </small>
                      </td>
                      <td class="text-end align-top">
                        <small>{{ formatter.money(travel.addUp.lumpSums) }}</small>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <small>{{ t('labels.expenses') }}</small>
                      </td>
                      <td class="text-end">
                        <small>{{ formatter.money(travel.addUp.expenses) }}</small>
                      </td>
                    </tr>
                    <tr v-if="travel.advance.amount">
                      <td class="text-secondary">
                        <small>{{ t('labels.advance') }}</small>
                      </td>
                      <td class="text-end text-secondary">
                        <small>{{ formatter.money(travel.addUp.advance, { func: (x) => 0 - x }) }}</small>
                      </td>
                    </tr>
                    <tr>
                      <th>{{ t('labels.balance') }}</th>
                      <td class="text-end">{{ formatter.money(travel.addUp.balance) }}</td>
                    </tr>
                  </tbody>
                </table>
                <div v-if="travel.comments.length > 0" class="mb-3 p-2 pb-0 bg-light-subtle">
                  <small>
                    <p v-for="comment of travel.comments" :key="comment._id">
                      <span class="fw-bold">{{ comment.author.name.givenName + ': ' }}</span>
                      <span>{{ comment.text }}</span>
                    </p>
                  </small>
                </div>
                <template v-if="travel.state !== 'refunded'">
                  <div class="mb-3">
                    <label for="comment" class="form-label">{{ t('labels.comment') }}</label>
                    <textarea
                      class="form-control"
                      id="comment"
                      rows="1"
                      v-model="travel.comment"
                      :disabled="isReadOnly && !(endpointPrefix === 'examine/' && travel.state === 'underExamination')"></textarea>
                  </div>
                  <template v-if="travel.state === 'approved'">
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
                  </template>
                  <template v-else-if="travel.state === 'underExamination'">
                    <button v-if="endpointPrefix === 'examine/'" class="btn btn-success mb-2" @click="refund()">
                      <i class="bi bi-coin"></i>
                      <span class="ms-1">{{ t('labels.refund') }}</span>
                    </button>
                    <button
                      class="btn btn-secondary"
                      @click="travel.editor._id !== travel.owner._id ? null : backToApproved()"
                      :disabled="travel.editor._id !== travel.owner._id">
                      <i class="bi bi-arrow-counterclockwise"></i>
                      <span class="ms-1">{{ t(endpointPrefix === 'examine/' ? 'labels.backToApplicant' : 'labels.editAgain') }}</span>
                    </button>
                  </template>
                </template>
                <a v-else-if="travel.state === 'refunded'" class="btn btn-primary" :href="reportLink" :download="travel.name + '.pdf'">
                  <i class="bi bi-download"></i>
                  <span class="ms-1">{{ t('labels.downloadX', { X: t('labels.report') }) }}</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { PropType } from 'vue'
import { computed, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { mailToLink as mailLinkFunc, msTeamsToLink as teamsLinkFunc } from '@/../../common/scripts.js'
import {
  DocumentFile,
  Place,
  Stage,
  Travel,
  TravelDay,
  TravelExpense,
  TravelRecord,
  TravelRecordType,
  TravelSimple,
  User,
  UserSimple,
  meals,
  travelStates
} from '@/../../common/types.js'
import API from '@/api.js'
import APP_LOADER from '@/appData.js'
import ErrorBanner from '@/components/elements/ErrorBanner.vue'
import InfoPoint from '@/components/elements/InfoPoint.vue'
import ModalComponent from '@/components/elements/ModalComponent.vue'
import PlaceElement from '@/components/elements/PlaceElement.vue'
import ProgressCircle from '@/components/elements/ProgressCircle.vue'
import StatePipeline from '@/components/elements/StatePipeline.vue'
import TooltipElement from '@/components/elements/TooltipElement.vue'
import ExpenseForm from '@/components/travel/forms/ExpenseForm.vue'
import StageForm from '@/components/travel/forms/StageForm.vue'
import TravelApplyForm from '@/components/travel/forms/TravelApplyForm.vue'
import { formatter } from '@/formatter.js'
import { logger } from '@/logger.js'

type Gap = { departure: Stage['arrival']; startLocation: Stage['endLocation'] }
type ModalMode = 'add' | 'edit'
type ModalObject = Partial<TravelRecord> | Partial<TravelSimple> | Gap
type ModalObjectType = TravelRecordType | 'travel'
type Day = TravelDay & { showSettings?: boolean }
type Table = (
  | { type: 'stage'; data: Stage }
  | { type: 'expense'; data: TravelExpense }
  | { type: 'day'; data: Day }
  | { type: 'gap'; data: Gap }
)[]

const props = defineProps({
  _id: { type: String, required: true },
  parentPages: { type: Array as PropType<{ link: string; title: string }[]>, required: true },
  endpointPrefix: { type: String, default: '' }
})

const router = useRouter()
const { t } = useI18n()

const travel = ref<Travel>({} as Travel)
const modalObject = ref<ModalObject>({})
const modalMode = ref<ModalMode>('add')
const modalObjectType = ref<ModalObjectType>('stage')
const table = ref<Table>([])
const error = ref<any>(undefined)
const isReadOnlySwitchOn = ref(true)
const modalFormIsLoading = ref(false)

await APP_LOADER.loadData()
const APP_DATA = APP_LOADER.data

const modalCompRef = useTemplateRef('modalComp')

const isReadOnly = computed(() => {
  return (
    (travel.value.state === 'underExamination' ||
      travel.value.state === 'refunded' ||
      (travel.value.state === 'approved' && props.endpointPrefix === 'examine/')) &&
    isReadOnlySwitchOn.value
  )
})

function showModal(mode: ModalMode, type: ModalObjectType, object?: ModalObject | Gap) {
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

async function postTravelSettings() {
  const travelObj = {
    _id: travel.value._id,
    claimOvernightLumpSum: travel.value.claimOvernightLumpSum,
    lastPlaceOfWork: travel.value.lastPlaceOfWork,
    days: travel.value.days
  }
  const result = await API.setter<Travel>(`${props.endpointPrefix}travel`, travelObj)
  if (result.ok) {
    setTravel(result.ok)
  } else {
    await getTravel()
  }
}

async function editTravelDetails(updatedTravel: Travel) {
  if (props.endpointPrefix === 'examine/') {
    modalFormIsLoading.value = true
    const result = await API.setter<Travel>(`${props.endpointPrefix}travel`, updatedTravel)
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
  const result = await API.setter<Travel>(`${props.endpointPrefix}travel/approved`, {
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

async function refund() {
  const result = await API.setter<Travel>('examine/travel/refunded', { _id: travel.value._id, comment: travel.value.comment })
  if (result.ok) {
    router.push({ path: '/examine/travel' })
  }
}

async function postStage(stage: Stage) {
  let headers: any = {}
  if (stage.cost.receipts) {
    headers = { 'Content-Type': 'multipart/form-data' }
  }
  if ((stage.cost.amount as unknown) === '') {
    stage.cost.amount = 0
  }
  modalFormIsLoading.value = true
  const result = await API.setter<Travel>(`${props.endpointPrefix}travel/stage`, stage, {
    headers,
    params: { parentId: travel.value._id }
  })
  modalFormIsLoading.value = false
  if (result.ok) {
    setTravel(result.ok)
    resetAndHide()
  } else if (result.error) {
    error.value = result.error
    const modalEl = document.getElementById('modal')
    if (modalEl) {
      modalEl.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }
}

async function deleteStage(_id: string) {
  modalFormIsLoading.value = true
  const result = await API.deleter(`${props.endpointPrefix}travel/stage`, { _id, parentId: props._id })
  modalFormIsLoading.value = false

  if (result) {
    setTravel(result)
    resetAndHide()
  }
}

async function postExpense(expense: TravelExpense) {
  let headers: any = {}
  if (expense.cost.receipts) {
    headers = { 'Content-Type': 'multipart/form-data' }
  }
  modalFormIsLoading.value = true
  const result = await API.setter<Travel>(`${props.endpointPrefix}travel/expense`, expense, {
    headers,
    params: { parentId: travel.value._id }
  })
  modalFormIsLoading.value = false
  if (result.ok) {
    setTravel(result.ok)
    resetAndHide()
  }
}

async function deleteExpense(_id: string) {
  modalFormIsLoading.value = true
  const result = await API.deleter(`${props.endpointPrefix}travel/expense`, { _id, parentId: props._id })
  modalFormIsLoading.value = false
  if (result) {
    setTravel(result)
    resetAndHide()
  }
}

async function postVehicleRegistration(vehicleRegistration: DocumentFile[]) {
  const result = await API.setter<User>(
    `${props.endpointPrefix}user/vehicleRegistration`,
    { vehicleRegistration },
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
  if (result.ok && APP_DATA.value) {
    APP_DATA.value.user = result.ok
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

function renderTable() {
  table.value = []
  let stageIndex = 0
  // Füge zuerst alle Ausgaben ein, die vor dem ersten Reisetag liegen:
  for (const expense of travel.value.expenses) {
    if (travel.value.days.length === 0 || expense.cost.date < travel.value.days[0].date) {
      table.value.push({ type: 'expense', data: expense })
    }
  }
  // Durchlaufe die Tage und ordne Stages und Ausgaben zu:
  for (let i = 0; i < travel.value.days.length; i++) {
    const stagesStart = stageIndex
    while (
      stageIndex < travel.value.stages.length &&
      i < travel.value.days.length - 1 &&
      new Date(travel.value.days[i + 1].date).valueOf() - new Date(travel.value.stages[stageIndex].departure).valueOf() > 0
    ) {
      stageIndex++
    }
    let stagesEnd = stageIndex
    if (i === travel.value.days.length - 1) {
      stagesEnd = travel.value.stages.length
    }
    table.value.push({ type: 'day', data: { ...travel.value.days[i] } as Day })
    for (const expense of travel.value.expenses) {
      if (expense.cost.date === travel.value.days[i].date) {
        table.value.push({ type: 'expense', data: expense })
      }
    }
    for (const stage of travel.value.stages.slice(stagesStart, stagesEnd)) {
      table.value.push({ type: 'stage', data: stage })
    }
  }
  // Füge eine "Gap" ein, falls vorhanden:
  if (travel.value.stages.length > 0) {
    const last = travel.value.stages[travel.value.stages.length - 1]
    table.value.push({ type: 'gap', data: { departure: last.arrival, startLocation: last.endLocation } })
  }
  // Füge alle Ausgaben ein, die nach dem letzten Tag liegen:
  if (travel.value.days.length > 0) {
    for (const expense of travel.value.expenses) {
      if (expense.cost.date > travel.value.days[travel.value.days.length - 1].date) {
        table.value.push({ type: 'expense', data: expense })
      }
    }
  }
}

async function getTravel() {
  const params: any = {
    _id: props._id,
    additionalFields: ['stages', 'expenses', 'days']
  }
  const res = (await API.getter<Travel>(`${props.endpointPrefix}travel`, params)).ok
  if (res) {
    setTravel(res.data)
  }
}

function setTravel(newTravel: Travel) {
  const oldTravel = travel.value
  travel.value = newTravel
  if (oldTravel.days && newTravel.days) {
    for (const oldDay of oldTravel.days) {
      if ((oldDay as Day).showSettings) {
        for (const newDay of newTravel.days) {
          if (new Date(newDay.date).valueOf() === new Date(oldDay.date).valueOf()) {
            ;(newDay as Day).showSettings = true
          }
        }
      }
    }
  }
  logger.info(`${t('labels.travel')}:`)
  logger.info(travel.value)
  renderTable()
}

async function getExaminerMails(): Promise<string[]> {
  const result = (await API.getter<UserSimple[]>('travel/examiner')).ok
  if (result) {
    return result.data.map((x) => x.email)
  }
  return []
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
      const adding: Omit<Place, 'place'> = {
        country: place.country
      }
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

try {
  await getTravel()
} catch (e) {
  router.push({ path: props.parentPages[props.parentPages.length - 1].link })
}
const mails = await getExaminerMails()
const mailToLinkVal = mailLinkFunc(mails)
const msTeamsToLinkVal = teamsLinkFunc(mails)

const reportLink = `${import.meta.env.VITE_BACKEND_URL}/${props.endpointPrefix}travel/report?_id=${travel.value._id}`
</script>

<style></style>
