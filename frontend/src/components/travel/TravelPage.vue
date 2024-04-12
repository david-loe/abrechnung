<template>
  <div>
    <div class="modal fade" id="modal" tabindex="-1" aria-labelledby="modalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg modal-fullscreen-sm-down">
        <div class="modal-content">
          <div class="modal-header">
            <h5 v-if="modalMode === 'add'" class="modal-title">
              {{
                $t('labels.newX', {
                  X: $t('labels.' + modalObjectType)
                })
              }}
            </h5>
            <h5 v-else class="modal-title">{{ $t('labels.editX', { X: $t('labels.' + modalObjectType) }) }}</h5>
            <button type="button" class="btn-close" @click="hideModal"></button>
          </div>
          <div v-if="travel._id" class="modal-body">
            <ErrorBanner :error="error"></ErrorBanner>
            <StageForm
              v-if="modalObjectType === 'stage'"
              ref="stageForm"
              :mode="modalMode"
              :stage="modalObject as Partial<Stage> | Gap | undefined"
              :travelStartDate="travel.startDate"
              :travelEndDate="travel.endDate"
              :disabled="isReadOnly"
              :showVehicleRegistration="travel.state === 'approved'"
              :endpointPrefix="endpointPrefix"
              @add="postStage"
              @edit="postStage"
              @deleted="deleteStage"
              @cancel="hideModal"
              @postVehicleRegistration="postVehicleRegistration">
            </StageForm>
            <ExpenseForm
              v-else-if="modalObjectType === 'expense'"
              ref="expenseForm"
              :expense="modalObject as Partial<TravelExpense> | undefined"
              :disabled="isReadOnly"
              :mode="modalMode"
              :endpointPrefix="endpointPrefix"
              @add="postExpense"
              @edit="postExpense"
              @deleted="deleteExpense"
              @cancel="hideModal">
            </ExpenseForm>
            <TravelApplyForm
              v-else-if="modalObjectType === 'travel'"
              :mode="modalMode"
              @cancel="hideModal"
              :travel="modalObject as TravelSimple"
              @edit="applyForTravel"
              ref="travelApplyForm"></TravelApplyForm>
          </div>
        </div>
      </div>
    </div>
    <div class="container" v-if="travel._id">
      <div class="row">
        <div class="col">
          <nav v-if="parentPages && parentPages.length > 0" aria-label="breadcrumb">
            <ol class="breadcrumb">
              <li class="breadcrumb-item" v-for="page of parentPages" :key="page.link">
                <router-link :to="page.link">{{ $t(page.title) }}</router-link>
              </li>
              <li class="breadcrumb-item active" aria-current="page">{{ travel.name }}</li>
            </ol>
          </nav>
        </div>
        <div class="col-auto">
          <div class="dropdown">
            <button type="button" class="btn btn-outline-info" data-bs-toggle="dropdown" aria-expanded="false">
              {{ $t('labels.help') }}
            </button>
            <ul class="dropdown-menu dropdown-menu-end">
              <li>
                <a class="dropdown-item" :href="mailToLink"><i class="bi bi-envelope-fill me-1"></i>Mail</a>
              </li>
              <li>
                <a class="dropdown-item" :href="msTeamsToLink" target="_blank"><i class="bi bi-microsoft-teams me-1"></i>Teams</a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div class="mb-2">
        <div class="row justify-content-between align-items-end">
          <div class="col-auto">
            <h1 class="m-0">{{ travel.name }}</h1>
          </div>
          <div class="col">
            <h4 class="text-secondary m-0">{{ datetoDateString(travel.startDate) + ' - ' + datetoDateString(travel.endDate) }}</h4>
          </div>
          <div class="col-auto">
            <div class="dropdown">
              <a class="nav-link link-dark" data-bs-toggle="dropdown" data-bs-auto-close="outside" href="#" role="button">
                <i class="bi bi-three-dots-vertical fs-3"></i>
              </a>
              <ul class="dropdown-menu dropdown-menu-end">
                <template v-if="endpointPrefix === 'examine/' && travel.state !== 'refunded'">
                  <li>
                    <div class="ps-3">
                      <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" role="switch" id="editTravel" v-model="isReadOnly" />
                        <label class="form-check-label text-nowrap" for="editTravel">
                          <span class="me-1"><i class="bi bi-lock"></i></span>
                          <span>{{ $t('labels.readOnly') }}</span>
                        </label>
                      </div>
                    </div>
                  </li>
                  <li>
                    <hr class="dropdown-divider" />
                  </li>
                </template>
                <li>
                  <a :class="'dropdown-item' + (isReadOnly ? ' disabled' : '')" href="#" @click="showModal('edit', travel, 'travel')">
                    <span class="me-1"><i class="bi bi-pencil"></i></span>
                    <span>{{ $t('labels.editX', { X: $t('labels.travelDetails') }) }}</span>
                  </a>
                </li>
                <li>
                  <a
                    :class="'dropdown-item' + (isReadOnly && endpointPrefix === 'examine/' ? ' disabled' : '')"
                    href="#"
                    @click="isReadOnly && endpointPrefix === 'examine/' ? null : deleteTravel()">
                    <span class="me-1"><i class="bi bi-trash"></i></span>
                    <span>{{ $t('labels.delete') }}</span>
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div v-if="endpointPrefix === 'examine/'" class="text-secondary">
          {{ travel.owner.name.givenName + ' ' + travel.owner.name.familyName + ' - ' + travel.project.identifier }}
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
            <label class="form-check-label" for="travelClaimOvernightLumpSum">{{ $t('labels.claimOvernightLumpSum') }}</label>
            <InfoPoint class="ms-1" :text="$t('info.claimOvernightLumpSum')" />
          </div>
        </div>
        <div class="col-auto">
          <div class="row align-items-center">
            <div class="col-auto pe-2">
              <label class="form-lable mb-0">{{ $t('labels.lastPlaceOfWork') }}</label>
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
              <InfoPoint :text="$t('info.lastPlaceOfWork')" />
            </div>
          </div>
        </div>
        <div v-if="travel.stages.length > 0 && travel.professionalShare !== null && travel.professionalShare !== 1" class="col-auto">
          <label class="form-check-label me-2" for="travelProfessionalShare">
            {{ $t('labels.professionalShare') + ':' }}
          </label>
          <span id="travelProfessionalShare" :class="travel.professionalShare <= 0.5 ? 'text-danger' : ''">
            {{ Math.round(travel.professionalShare * 100) + '%' }}</span
          >
          <InfoPoint class="ms-1" :text="$t('info.professionalShare')" />
        </div>
      </div>

      <div class="row row justify-content-between">
        <div class="col-lg-auto col-12">
          <div class="row g-1 mb-2">
            <div class="col-auto">
              <button class="btn btn-secondary" @click="isReadOnly ? null : showModal('add', undefined, 'stage')" :disabled="isReadOnly">
                <i class="bi bi-plus-lg"></i>
                <span class="ms-1 d-none d-md-inline">{{ $t('labels.addX', { X: $t('labels.stage') }) }}</span>
                <span class="ms-1 d-md-none">{{ $t('labels.stage') }}</span>
              </button>
            </div>
            <div class="col-auto">
              <button class="btn btn-secondary" @click="isReadOnly ? null : showModal('add', undefined, 'expense')" :disabled="isReadOnly">
                <i class="bi bi-plus-lg"></i>
                <span class="ms-1 d-none d-md-inline">{{ $t('labels.addX', { X: $t('labels.expense') }) }}</span>
                <span class="ms-1 d-md-none">{{ $t('labels.expense') }}</span>
              </button>
            </div>
          </div>
          <div class="row mb-2">
            <div class="col-auto">
              <button
                class="btn btn-link btn-sm"
                @click="travel.days.map((d) => ((d as Day).showSettings = true))"
                :disabled="travel.stages.length == 0">
                {{ $t('labels.expandAll') }}
                <i class="bi bi-arrows-expand"></i>
              </button>
            </div>
            <div class="col-auto">
              <button
                class="btn btn-link btn-sm"
                @click="travel.days.map((d) => ((d as Day).showSettings = false))"
                :disabled="travel.stages.length == 0">
                {{ $t('labels.collapseAll') }}
                <i class="bi bi-arrows-collapse"></i>
              </button>
            </div>
          </div>
          <div v-if="travel.stages.length == 0" class="alert alert-light" role="alert">
            {{ $t('alerts.noData.stage') }}
          </div>

          <div
            v-for="row of table"
            class="mb-2"
            :key="row.type === 'gap' ? (row.data as Gap).departure.toString() : (row.data as Record | Day)._id">
            <!-- day -->
            <div v-if="row.type === 'day'" class="row align-items-center mt-3">
              <div class="col-auto">
                <h5 class="m-0">
                  <small
                    v-if="(row.data as Day).purpose === 'private'"
                    :title="$t('labels.private')"
                    style="margin-left: -1.25rem; margin-right: 0.156rem">
                    <i class="bi bi-file-person"></i> </small
                  >{{ datetoDateString((row.data as Day).date) }}
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
                          $t('lumpSums.' + refund.type) +
                          ' ' +
                          (row.data as Day).country.flag +
                          ((row.data as Day).special ? ' (' + (row.data as Day).special + ')' : '')
                        ">
                        <i class="bi bi-sun"></i>
                        {{ getMoneyString(refund.refund, { language: $i18n.locale as Locale }) }}
                      </div>
                      <!-- overnight -->
                      <div
                        v-else
                        class="col-auto text-secondary"
                        :title="
                          (travel.claimSpouseRefund ? '2x ' : '') +
                          $t('lumpSums.' + refund.type) +
                          ' ' +
                          (row.data as Day).country.flag +
                          ((row.data as Day).special ? ' (' + (row.data as Day).special + ')' : '')
                        ">
                        <i class="bi bi-moon"></i>
                        {{ getMoneyString(refund.refund, { language: $i18n.locale as Locale }) }}
                      </div>
                    </template>
                  </template>
                  <template v-else>
                    <div class="col-auto pe-1">
                      <InfoPoint :text="$t('info.cateringNoRefund')" />
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
                        {{ $t('labels.' + key) }}
                      </label>
                    </div>
                    <div class="col-auto">
                      <div class="row align-items-center">
                        <div class="col-auto pe-1">
                          <InfoPoint :text="$t('info.purpose')" />
                        </div>
                        <div class="col-auto ps-0">
                          <select
                            class="form-select form-select-sm"
                            v-model="(row.data as Day).purpose"
                            @change="isReadOnly ? null : postTravelSettings()"
                            :disabled="isReadOnly"
                            required>
                            <option v-for="purpose of ['professional', 'private']" :value="purpose" :key="purpose">
                              {{ $t('labels.' + purpose) }}
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
              @click="showModal('edit', row.data as Stage, 'stage')">
              <div class="col-auto fs-3 d-none d-md-block">
                <i :class="getStageIcon(row.data as Stage)"></i>
              </div>
              <div class="col-auto text-truncate">
                <PlaceElement :place="(row.data as Stage).startLocation"></PlaceElement>
                <i :class="getStageIcon(row.data as Stage) + ' d-md-none'"></i>&nbsp;<i class="bi bi-arrow-right mx-2"></i>
                <div v-if="(row.data as Stage).cost.amount" class="ms-3 text-secondary d-inline d-md-none">
                  <i class="bi bi-coin"></i>
                  {{ getMoneyString((row.data as Stage).cost, { language: $i18n.locale as Locale }) }}
                </div>
                <PlaceElement :place="(row.data as Stage).endLocation"></PlaceElement>
              </div>
              <div v-if="(row.data as Stage).cost.amount" class="col-auto text-secondary d-none d-md-block">
                <i class="bi bi-coin"></i>
                {{ getMoneyString((row.data as Stage).cost, { language: $i18n.locale as Locale }) }}
              </div>
            </div>
            <!-- expense -->
            <div
              v-else-if="row.type === 'expense'"
              class="row align-items-center ps-lg-4 mb-1"
              style="cursor: pointer"
              @click="showModal('edit', row.data as TravelExpense, 'expense')">
              <div class="col-auto fs-3 d-none d-md-block">
                <i class="bi bi-coin"></i>
              </div>
              <div class="col-auto">
                <i class="bi bi-coin d-md-none"></i>&nbsp; {{ (row.data as TravelExpense).description }}&nbsp;
                <div class="text-secondary d-inline d-md-none">
                  {{ getMoneyString((row.data as TravelExpense).cost, { language: $i18n.locale as Locale }) }}
                </div>
              </div>
              <div class="col-auto text-secondary d-none d-md-block">
                {{ getMoneyString((row.data as TravelExpense).cost, { language: $i18n.locale as Locale }) }}
              </div>
            </div>
            <!-- gap -->
            <div v-else-if="row.type === 'gap'" class="row ps-5">
              <div class="col-auto">
                <button class="btn btn-sm btn-light" @click="showModal('add', row.data as Gap, 'stage')" style="border-radius: 50%">
                  <i class="bi bi-plus-lg"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="col-lg-3 col">
          <div class="card">
            <div class="card-body">
              <h5 class="card-title">{{ $t('labels.summary') }}</h5>
              <div>
                <table class="table align-bottom">
                  <tbody>
                    <tr>
                      <th>{{ $t('labels.progress') }}</th>
                      <td class="text-end">
                        <ProgressCircle :progress="travel.progress"></ProgressCircle>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <small>
                          {{ $t('labels.lumpSums') }}
                          <small v-if="travel.claimSpouseRefund">
                            <br />
                            {{ $t('labels.includingSpouseRefund') }}
                          </small>
                        </small>
                      </td>
                      <td class="text-end align-top">
                        <small>{{ getMoneyString(addUp.lumpSums, { language: $i18n.locale as Locale }) }}</small>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <small>{{ $t('labels.expenses') }}</small>
                      </td>
                      <td class="text-end">
                        <small>{{ getMoneyString(addUp.expenses, { language: $i18n.locale as Locale }) }}</small>
                      </td>
                    </tr>
                    <tr v-if="travel.advance.amount">
                      <td class="text-secondary">
                        <small>{{ $t('labels.advance') }}</small>
                      </td>
                      <td class="text-end text-secondary">
                        <small>{{ getMoneyString(addUp.advance, { language: $i18n.locale as Locale, func: (x) => 0 - x }) }}</small>
                      </td>
                    </tr>
                    <tr>
                      <th>{{ $t('labels.total') }}</th>
                      <td class="text-end">{{ getMoneyString(addUp.total, { language: $i18n.locale as Locale }) }}</td>
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
                    <label for="comment" class="form-label">{{ $t('labels.comment') }}</label>
                    <textarea
                      class="form-control"
                      id="comment"
                      rows="1"
                      v-model="travel.comment"
                      :disabled="isReadOnly && endpointPrefix !== 'examine/'"></textarea>
                  </div>
                  <button v-if="endpointPrefix === 'examine/'" class="btn btn-success mb-2" @click="refund()">
                    <i class="bi bi-coin"></i>
                    <span class="ms-1">{{ $t('labels.refund') }}</span>
                  </button>
                </template>
                <template v-else>
                  <a class="btn btn-primary" :href="reportLink()" :download="travel.name + '.pdf'">
                    <i class="bi bi-download"></i>
                    <span class="ms-1">{{ $t('labels.downloadX', { X: $t('labels.report') }) }}</span>
                  </a>
                </template>
                <button
                  v-if="travel.state === 'approved'"
                  class="btn btn-primary"
                  @click="isReadOnly ? null : toExamination()"
                  :disabled="isReadOnly || travel.stages.length < 1">
                  <i class="bi bi-pencil-square"></i>
                  <span class="ms-1">{{ $t('labels.toExamination') }}</span>
                </button>
                <button
                  v-if="travel.state === 'underExamination'"
                  class="btn btn-secondary"
                  @click="travel.editor._id !== $root.user._id ? null : backToApproved()"
                  :disabled="travel.editor._id !== $root.user._id">
                  <i class="bi bi-arrow-counterclockwise"></i>
                  <span class="ms-1">{{ $t(endpointPrefix === 'examine/' ? 'labels.backToApplicant' : 'labels.editAgain') }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Modal } from 'bootstrap'
import { defineComponent, PropType } from 'vue'
import { log } from '../../../../common/logger.js'
import { addUp, datetoDateString, getMoneyString, mailToLink, msTeamsToLink } from '../../../../common/scripts.js'
import {
  BaseCurrencyMoney,
  DocumentFile,
  Locale,
  meals,
  Place,
  Record,
  RecordType,
  Stage,
  Travel,
  TravelDay,
  TravelExpense,
  TravelSimple,
  travelStates,
  User,
  UserSimple
} from '../../../../common/types.js'
import ErrorBanner from '../elements/ErrorBanner.vue'
import InfoPoint from '../elements/InfoPoint.vue'
import PlaceElement from '../elements/PlaceElement.vue'
import ProgressCircle from '../elements/ProgressCircle.vue'
import StatePipeline from '../elements/StatePipeline.vue'
import ExpenseForm from './forms/ExpenseForm.vue'
import StageForm from './forms/StageForm.vue'
import TravelApplyForm from './forms/TravelApplyForm.vue'

type Gap = { departure: Stage['arrival']; startLocation: Stage['endLocation'] }
type ModalMode = 'add' | 'edit'
type ModalObject = Record | TravelSimple | Gap | undefined
type ModalObjectType = RecordType | 'travel'
type Day = TravelDay & { showSettings?: boolean }
export default defineComponent({
  name: 'TravelPage',
  data() {
    return {
      travel: {} as Travel,
      modal: undefined as Modal | undefined,
      modalObject: undefined as ModalObject,
      modalMode: 'add' as ModalMode,
      modalObjectType: 'stage' as ModalObjectType,
      table: [] as {
        type: RecordType | 'gap' | 'day'
        data: Record | Day | Gap
      }[],
      configCateringRefund: false,
      isReadOnly: false,
      meals,
      travelStates,
      mailToLink: '',
      msTeamsToLink: '',
      error: undefined as any,
      addUp: {} as { total: BaseCurrencyMoney; advance: BaseCurrencyMoney; expenses: BaseCurrencyMoney; lumpSums: BaseCurrencyMoney }
    }
  },
  components: { StatePipeline, StageForm, InfoPoint, PlaceElement, ProgressCircle, ExpenseForm, TravelApplyForm, ErrorBanner },
  props: {
    _id: { type: String, required: true },
    parentPages: {
      type: Array as PropType<{ link: string; title: string }[]>,
      required: true
    },
    endpointPrefix: { type: String, default: '' }
  },
  methods: {
    showModal(mode: ModalMode, object: ModalObject | Gap, type: ModalObjectType) {
      this.modalObjectType = type
      this.modalObject = object
      this.modalMode = mode
      if (this.modal) {
        this.modal.show()
      }
    },
    hideModal() {
      if (this.modal) {
        this.modal.hide()
      }
      if (this.$refs.stageForm) {
        ;(this.$refs.stageForm as typeof StageForm).clear()
      }
      if (this.$refs.expenseForm) {
        ;(this.$refs.expenseForm as typeof ExpenseForm).clear()
      }
      this.modalObject = undefined
      this.error = undefined
    },
    async postTravelSettings() {
      const travel = {
        _id: this.travel._id,
        claimOvernightLumpSum: this.travel.claimOvernightLumpSum,
        lastPlaceOfWork: this.travel.lastPlaceOfWork,
        days: this.travel.days
      }
      const result = await this.$root.setter<Travel>(this.endpointPrefix + 'travel', travel)
      if (result.ok) {
        this.setTravel(result.ok)
      } else {
        await this.getTravel()
      }
    },
    async applyForTravel(travel: Travel) {
      if (confirm(this.$t('alerts.warningReapply'))) {
        const result = await this.$root.setter<Travel>('travel/appliedFor', travel)
        if (result.ok) {
          this.hideModal()
          this.$router.push({ path: '/' })
        } else {
          await this.getTravel()
        }
      }
    },
    async deleteTravel() {
      const result = await this.$root.deleter(this.endpointPrefix + 'travel', { _id: this._id })
      if (result) {
        this.$router.push({ path: '/' })
      }
    },
    async toExamination() {
      const result = await this.$root.setter<Travel>('travel/underExamination', { _id: this.travel._id, comment: this.travel.comment })
      if (result.ok) {
        this.$router.push({ path: '/' })
      }
    },
    async backToApproved() {
      const result = await this.$root.setter<Travel>(this.endpointPrefix + 'travel/approved', {
        _id: this.travel._id,
        comment: this.travel.comment
      })
      if (result.ok) {
        if (this.endpointPrefix === 'examine/') {
          this.$router.push({ path: '/examine/travel' })
        } else {
          this.setTravel(result.ok)
          this.isReadOnly = ['underExamination', 'refunded'].indexOf(this.travel.state) !== -1
        }
      }
    },
    async refund() {
      const result = await this.$root.setter<Travel>('examine/travel/refunded', { _id: this.travel._id, comment: this.travel.comment })
      if (result.ok) {
        this.$router.push({ path: '/examine/travel' })
      }
    },
    reportLink() {
      return import.meta.env.VITE_BACKEND_URL + '/' + this.endpointPrefix + 'travel/report?_id=' + this.travel._id
    },
    async postStage(stage: Stage) {
      var headers = {}
      if (stage.cost.receipts) {
        headers = {
          'Content-Type': 'multipart/form-data'
        }
      }
      // When clearing the number form field '' is returned. This would cause error as only number|null is excepted
      if ((stage.cost.amount as unknown) === '') {
        stage.cost.amount = 0
      }
      const result = await this.$root.setter<Travel>(this.endpointPrefix + 'travel/stage', stage, {
        headers,
        params: { parentId: this.travel._id }
      })
      if (result.ok) {
        this.setTravel(result.ok)
        this.hideModal()
      } else if (result.error) {
        this.error = result.error
        ;(this.$refs.stageForm as typeof StageForm).loading = false
        const modalEl = document.getElementById('modal')
        if (modalEl) {
          modalEl.scrollTo({ top: 0, behavior: 'smooth' })
        }
      }
    },
    async deleteStage(_id: string) {
      const result = await this.$root.deleter(this.endpointPrefix + 'travel/stage', { _id, parentId: this._id })
      if (result) {
        this.setTravel(result)
        this.hideModal()
      }
    },
    async postExpense(expense: TravelExpense) {
      var headers = {}
      if (expense.cost.receipts) {
        headers = {
          'Content-Type': 'multipart/form-data'
        }
      }
      const result = await this.$root.setter<Travel>(this.endpointPrefix + 'travel/expense', expense, {
        headers,
        params: { parentId: this.travel._id }
      })
      if (result.ok) {
        this.setTravel(result.ok)
        this.hideModal()
      } else {
        ;(this.$refs.expenseForm as typeof ExpenseForm).loading = false
      }
    },
    async deleteExpense(_id: string) {
      const result = await this.$root.deleter(this.endpointPrefix + 'travel/expense', { _id, parentId: this._id })
      if (result) {
        this.setTravel(result)
        this.hideModal()
      }
    },
    async postVehicleRegistration(vehicleRegistration: DocumentFile[]) {
      const result = await this.$root.setter<User>(
        this.endpointPrefix + 'user/vehicleRegistration',
        { vehicleRegistration },
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      )
      if (result.ok) {
        this.$root.user = result.ok
      }
    },
    getStageIcon(stage: Stage) {
      var icon = null
      if (stage.transport.type == 'ownCar') {
        icon = 'bi bi-car-front'
      } else if (stage.transport.type == 'airplane') {
        icon = 'bi bi-airplane'
      } else if (stage.transport.type == 'shipOrFerry') {
        icon = 'bi bi-water'
      } else if (stage.transport.type == 'otherTransport') {
        icon = 'bi bi-train-front'
      }
      return icon
    },
    renderTable() {
      this.table = []
      var stageIndex = 0
      for (const expense of this.travel.expenses) {
        if (this.travel.days.length === 0 || expense.cost.date < this.travel.days[0].date) {
          this.table.push({ type: 'expense', data: expense })
        }
      }
      for (var i = 0; i < this.travel.days.length; i++) {
        var stagesStart = stageIndex
        while (
          stageIndex < this.travel.stages.length &&
          i < this.travel.days.length - 1 &&
          new Date(this.travel.days[i + 1].date).valueOf() - new Date(this.travel.stages[stageIndex].departure).valueOf() > 0
        ) {
          stageIndex++
        }
        var stagesEnd = stageIndex
        if (i == this.travel.days.length - 1) {
          stagesEnd = this.travel.stages.length
        }
        this.table.push({ type: 'day', data: this.travel.days[i] as Day })
        for (const expense of this.travel.expenses) {
          if (expense.cost.date == this.travel.days[i].date) {
            this.table.push({ type: 'expense', data: expense })
          }
        }
        for (const stage of this.travel.stages.slice(stagesStart, stagesEnd)) {
          this.table.push({ type: 'stage', data: stage })
        }
      }
      if (this.travel.stages.length > 0) {
        const last = this.travel.stages[this.travel.stages.length - 1]
        this.table.push({ type: 'gap', data: { departure: last.arrival, startLocation: last.endLocation } })
      }

      if (this.travel.days.length > 0) {
        for (const expense of this.travel.expenses) {
          if (expense.cost.date > this.travel.days[this.travel.days.length - 1].date) {
            this.table.push({ type: 'expense', data: expense })
          }
        }
      }
    },
    async getTravel() {
      const params: any = {
        _id: this._id,
        additionalFields: ['stages', 'expenses', 'days']
      }
      const res = (await this.$root.getter<Travel>(this.endpointPrefix + 'travel', params)).ok
      if (res) {
        this.setTravel(res.data)
      }
    },
    setTravel(travel: Travel) {
      const oldTravel = this.travel
      this.travel = travel
      this.addUp = addUp(this.travel)
      if (oldTravel.days && this.travel.days) {
        for (const oldDay of oldTravel.days) {
          if ((oldDay as Day).showSettings) {
            for (const newDay of this.travel.days) {
              if (new Date(newDay.date).valueOf() == new Date(oldDay.date).valueOf()) {
                ;(newDay as Day).showSettings = true
              }
            }
          }
        }
      }
      log(this.$t('labels.travel') + ':')
      log(this.travel)
      this.renderTable()
    },
    async getExaminerMails() {
      const result = (await this.$root.getter<UserSimple[]>('travel/examiner')).ok
      if (result) {
        return result.data.map((x) => x.email)
      }
      return []
    },
    getLastPaceOfWorkList(travel: Travel) {
      const list: Omit<Place, 'place'>[] = []
      function add(place: Place, list: Omit<Place, 'place'>[]) {
        var found = false
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
            adding['special'] = place.special
          }
          list.push(adding)
        }
      }
      add(travel.destinationPlace, list)
      for (const stage of travel.stages) {
        add(stage.startLocation, list)
        add(stage.endLocation, list)
      }
      return list
    },
    getMoneyString,
    datetoDateString
  },
  async created() {
    await this.$root.load()
    try {
      await this.getTravel()
    } catch (e) {
      return this.$router.push({ path: this.parentPages[this.parentPages.length - 1].link })
    }
    this.isReadOnly = ['underExamination', 'refunded'].indexOf(this.travel.state) !== -1
    const mails = await this.getExaminerMails()
    this.mailToLink = mailToLink(mails)
    this.msTeamsToLink = msTeamsToLink(mails)
  },
  mounted() {
    const modalEl = document.getElementById('modal')
    if (modalEl) {
      this.modal = new Modal(modalEl, {})
    }
  }
})
</script>

<style></style>
