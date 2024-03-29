<template>
  <div>
    <div class="modal fade" id="modal" tabindex="-1" aria-labelledby="modalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg modal-fullscreen-sm-down">
        <div class="modal-content">
          <div class="modal-header">
            <h5 v-if="modalMode === 'add'" class="modal-title">
              {{
                $t('labels.newX', {
                  X: $t('labels.expense')
                })
              }}
            </h5>
            <h5 v-else class="modal-title">{{ $t('labels.editX', { X: $t('labels.expense') }) }}</h5>
            <button type="button" class="btn-close" @click="hideModal"></button>
          </div>
          <div v-if="healthCareCost._id" class="modal-body">
            <ExpenseForm
              ref="expenseForm"
              :expense="modalExpense as Partial<Expense> | undefined"
              :disabled="isReadOnly"
              :mode="modalMode"
              :endpointPrefix="endpointPrefix"
              @add="postExpense"
              @edit="postExpense"
              @deleted="deleteExpense"
              @cancel="hideModal">
            </ExpenseForm>
          </div>
        </div>
      </div>
    </div>
    <div class="container" v-if="healthCareCost._id">
      <div class="row">
        <div class="col">
          <nav v-if="parentPages && parentPages.length > 0" aria-label="breadcrumb">
            <ol class="breadcrumb">
              <li class="breadcrumb-item" v-for="page of parentPages" :key="page.link">
                <router-link :to="page.link">{{ $t(page.title) }}</router-link>
              </li>
              <li class="breadcrumb-item active" aria-current="page">{{ healthCareCost.name }}</li>
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
            <h1 class="m-0">{{ healthCareCost.name }}</h1>
          </div>
          <div class="col-auto">
            <div class="dropdown">
              <a class="nav-link link-dark" data-bs-toggle="dropdown" data-bs-auto-close="outside" href="#" role="button">
                <i class="bi bi-three-dots-vertical fs-3"></i>
              </a>
              <ul class="dropdown-menu dropdown-menu-end">
                <template v-if="endpointPrefix === 'examine/' && healthCareCost.state === 'underExamination'">
                  <li>
                    <div class="ps-3">
                      <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" role="switch" id="editHealthCareCost" v-model="isReadOnly" />
                        <label class="form-check-label text-nowrap" for="editHealthCareCost">
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
                  <a
                    :class="'dropdown-item' + (isReadOnly && endpointPrefix !== '' ? ' disabled' : '')"
                    href="#"
                    @click="isReadOnly && endpointPrefix !== '' ? null : deleteHealthCareCost()">
                    <span class="me-1"><i class="bi bi-trash"></i></span>
                    <span>{{ $t('labels.delete') }}</span>
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div v-if="endpointPrefix !== ''" class="text-secondary">
          {{ healthCareCost.owner.name.givenName + ' ' + healthCareCost.owner.name.familyName + ' - ' + healthCareCost.project.identifier }}
        </div>
      </div>

      <StatePipeline class="mb-3" :state="healthCareCost.state" :states="healthCareCostStates"></StatePipeline>

      <div class="row row justify-content-between">
        <div class="col-lg-auto col-12">
          <div class="row g-1 mb-3">
            <div class="col-auto">
              <button class="btn btn-secondary" @click="isReadOnly ? null : showModal('add', undefined)" :disabled="isReadOnly">
                <i class="bi bi-plus-lg"></i>
                <span class="ms-1 d-none d-md-inline">{{ $t('labels.addX', { X: $t('labels.healthCareCost') }) }}</span>
                <span class="ms-1 d-md-none">{{ $t('labels.healthCareCost') }}</span>
              </button>
            </div>
          </div>
          <div v-if="healthCareCost.expenses.length == 0" class="alert alert-light" role="alert">
            {{ $t('alerts.noData.healthCareCost') }}
          </div>
          <table v-else class="table">
            <thead>
              <tr>
                <th scope="col">{{ $t('labels.date') }}</th>
                <th scope="col">{{ $t('labels.description') }}</th>
                <th scope="col">{{ $t('labels.amount') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="expense of healthCareCost.expenses" :key="expense._id" style="cursor: pointer" @click="showModal('edit', expense)">
                <td>{{ datetoDateString(expense.cost.date) }}</td>
                <td>{{ expense.description }}</td>
                <td>{{ getMoneyString(expense.cost, { language: $i18n.locale }) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div
          :class="
            endpointPrefix === 'confirm/' && healthCareCost.state === 'underExaminationByInsurance' ? 'col-lg-4 col' : 'col-lg-3 col'
          ">
          <div class="card">
            <div class="card-body">
              <h5 class="card-title">{{ $t('labels.summary') }}</h5>
              <div>
                <table class="table align-bottom">
                  <tbody>
                    <tr>
                      <th>{{ $t('labels.total') }}</th>
                      <td class="text-end">{{ getMoneyString(addUp.total, { language: $i18n.locale }) }}</td>
                    </tr>
                    <tr v-if="healthCareCost.state === 'refunded'">
                      <th>{{ $t('labels.refundSum') }}</th>
                      <td class="text-end">{{ getMoneyString(healthCareCost.refundSum, { language: $i18n.locale }) }}</td>
                    </tr>
                  </tbody>
                </table>
                <div v-if="healthCareCost.comments.length > 0" class="mb-3 p-2 pb-0 bg-light-subtle">
                  <small>
                    <p v-for="comment of healthCareCost.comments" :key="comment._id">
                      <span class="fw-bold">{{ comment.author.name.givenName + ': ' }}</span>
                      <span>{{ comment.text }}</span>
                    </p>
                  </small>
                </div>
                <div v-if="healthCareCost.state !== 'refunded'" class="mb-3">
                  <label for="comment" class="form-label">{{ $t('labels.comment') }}</label>
                  <textarea
                    class="form-control"
                    id="comment"
                    rows="1"
                    v-model="healthCareCost.comment as string | undefined"
                    :disabled="
                      (isReadOnly && endpointPrefix === '') ||
                      (healthCareCost.state === 'underExaminationByInsurance' && endpointPrefix === 'examine/')
                    "></textarea>
                </div>

                <button
                  v-if="healthCareCost.state === 'inWork'"
                  class="btn btn-primary"
                  @click="isReadOnly ? null : toExamination()"
                  :disabled="isReadOnly || healthCareCost.expenses.length < 1">
                  <i class="bi bi-pencil-square"></i>
                  <span class="ms-1">{{ $t('labels.toExamination') }}</span>
                </button>
                <template v-else-if="healthCareCost.state === 'refunded' || healthCareCost.state === 'underExaminationByInsurance'">
                  <a class="btn btn-primary" :href="reportLink()" :download="healthCareCost.name + '.pdf'">
                    <i class="bi bi-download"></i>
                    <span class="ms-1">{{ $t('labels.downloadX', { X: $t('labels.report') }) }}</span>
                  </a>
                  <a v-if="endpointPrefix === 'examine/'" class="btn btn-secondary mt-2" :href="mailToInsuranceLink(healthCareCost)">
                    <i class="bi bi-envelope"></i>
                    <span class="ms-1">{{ $t('labels.mailToInsurance') }}</span>
                  </a>
                </template>
                <template v-else>
                  <a
                    v-if="endpointPrefix === 'examine/'"
                    class="btn btn-primary mb-2"
                    :href="mailToInsuranceLink(healthCareCost)"
                    @click="toExaminationByInsurance()">
                    <i class="bi bi-pencil-square"></i>
                    <span class="ms-1">{{ $t('labels.toExaminationByInsurance') }}</span>
                  </a>
                  <button
                    class="btn btn-secondary"
                    @click="healthCareCost.editor._id !== $root.user._id ? null : backToInWork()"
                    :disabled="healthCareCost.editor._id !== $root.user._id">
                    <i class="bi bi-arrow-counterclockwise"></i>
                    <span class="ms-1">{{ $t(endpointPrefix === 'examine/' ? 'labels.backToApplicant' : 'labels.editAgain') }}</span>
                  </button>
                </template>

                <form
                  class="mt-3"
                  v-if="endpointPrefix === 'confirm/' && healthCareCost.state === 'underExaminationByInsurance'"
                  @submit.prevent="refund()">
                  <label for="refundSum" class="form-label me-2"> {{ $t('labels.refundSum') }}<span class="text-danger">*</span> </label>
                  <div id="refundSum" class="input-group mb-3">
                    <input
                      style="min-width: 100px"
                      type="number"
                      class="form-control"
                      step="0.01"
                      v-model="healthCareCost.refundSum.amount"
                      min="0"
                      required />
                    <CurrencySelector v-model="healthCareCost.refundSum!.currency" :required="true"></CurrencySelector>
                  </div>
                  <div class="mb-3">
                    <label for="expenseFormFile" class="form-label me-2">{{ $t('labels.receipts') }}</label>
                    <FileUpload
                      ref="fileUpload"
                      id="expenseFormFile"
                      v-model="healthCareCost.refundSum.receipts as DocumentFile[] | undefined"
                      :endpointPrefix="endpointPrefix" />
                  </div>
                  <button type="submit" class="btn btn-success">
                    <i class="bi bi-coin"></i>
                    <span class="ms-1">{{ $t('labels.confirm') }}</span>
                  </button>
                </form>
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
import { addUp, datetoDateString, getById, getMoneyString, mailToLink, msTeamsToLink } from '../../../../common/scripts.js'
import {
  BaseCurrencyMoney,
  DocumentFile,
  Expense,
  HealthCareCost,
  healthCareCostStates,
  Organisation,
  UserSimple
} from '../../../../common/types.js'
import CurrencySelector from '../elements/CurrencySelector.vue'
import FileUpload from '../elements/FileUpload.vue'
import StatePipeline from '../elements/StatePipeline.vue'
import ExpenseForm from './forms/ExpenseForm.vue'

type ModalMode = 'add' | 'edit'

export default defineComponent({
  name: 'HealthCareCostPage',
  data() {
    return {
      healthCareCost: {} as HealthCareCost,
      modal: undefined as Modal | undefined,
      modalExpense: undefined as Expense | undefined,
      modalMode: 'add' as ModalMode,
      isReadOnly: false,
      healthCareCostStates,
      mailToLink: '',
      msTeamsToLink: '',
      organisations: [] as Organisation[],
      addUp: {} as { total: BaseCurrencyMoney; expenses: BaseCurrencyMoney }
    }
  },
  components: { StatePipeline, ExpenseForm, CurrencySelector, FileUpload },
  props: {
    _id: { type: String, required: true },
    parentPages: {
      type: Array as PropType<{ link: string; title: string }[]>,
      required: true
    },
    endpointPrefix: { type: String, default: '' }
  },
  methods: {
    showModal(mode: ModalMode, expense: Expense | undefined) {
      this.modalExpense = expense
      this.modalMode = mode
      if (this.modal) {
        this.modal.show()
      }
    },
    hideModal() {
      if (this.modal) {
        this.modal.hide()
      }
      if (this.$refs.expenseForm) {
        ;(this.$refs.expenseForm as typeof ExpenseForm).clear()
      }
      this.modalExpense = undefined
    },
    async deleteHealthCareCost() {
      const result = await this.$root.deleter(this.endpointPrefix + 'healthCareCost', { _id: this._id })
      if (result) {
        this.$router.push({ path: this.parentPages[0].link })
      }
    },
    async toExamination() {
      const result = await this.$root.setter<HealthCareCost>('healthCareCost/underExamination', {
        _id: this.healthCareCost._id,
        comment: this.healthCareCost.comment
      })
      if (result.ok) {
        this.$router.push({ path: this.parentPages[0].link })
      }
    },
    async backToInWork() {
      const result = await this.$root.setter<HealthCareCost>(this.endpointPrefix + 'healthCareCost/inWork', {
        _id: this.healthCareCost._id,
        comment: this.healthCareCost.comment
      })
      if (result.ok) {
        if (this.endpointPrefix === 'examine/') {
          this.$router.push({ path: '/examine/healthCareCost' })
        } else {
          this.setHealthCareCost(result.ok)
          this.isReadOnly = ['underExamination', 'refunded'].indexOf(this.healthCareCost.state) !== -1
        }
      }
    },
    async toExaminationByInsurance() {
      const result = await this.$root.setter<HealthCareCost>('examine/healthCareCost/underExaminationByInsurance', {
        _id: this.healthCareCost._id,
        comment: this.healthCareCost.comment
      })
      if (result.ok) {
        this.getHealthCareCost()
      }
    },
    mailToInsuranceLink(healthCareCost: HealthCareCost): string {
      const orga = getById(healthCareCost.project.organisation, this.organisations)
      return mailToLink(
        [healthCareCost.insurance.email],
        this.$t('mail.underExaminationByInsurance.subject', { companyNumber: orga?.companyNumber }),
        this.$t('mail.underExaminationByInsurance.body', {
          insuranceName: healthCareCost.insurance.name,
          owner: healthCareCost.owner.name.givenName + ' ' + healthCareCost.owner.name.familyName,
          bankDetails: orga?.bankDetails,
          organisationName: orga?.name,
          amount: getMoneyString(this.addUp.total, { language: this.$i18n.locale })
        })
      )
    },
    async refund() {
      var headers = {}
      if (this.healthCareCost.refundSum.receipts && this.healthCareCost.refundSum.receipts.length > 0) {
        headers = {
          'Content-Type': 'multipart/form-data'
        }
      }
      const result = await this.$root.setter<HealthCareCost>(
        'confirm/healthCareCost/refunded',
        {
          _id: this.healthCareCost._id,
          comment: this.healthCareCost.comment,
          refundSum: this.healthCareCost.refundSum
        },
        { headers }
      )
      if (result.ok) {
        this.$router.push({ path: this.parentPages[0].link })
      }
    },
    reportLink() {
      return import.meta.env.VITE_BACKEND_URL + '/' + this.endpointPrefix + 'healthCareCost/report?_id=' + this.healthCareCost._id
    },
    async postExpense(expense: Expense) {
      var headers = {}
      if (expense.cost.receipts) {
        headers = {
          'Content-Type': 'multipart/form-data'
        }
      }
      const result = await this.$root.setter<HealthCareCost>(this.endpointPrefix + 'healthCareCost/expense', expense, {
        headers,
        params: { parentId: this.healthCareCost._id }
      })
      if (result.ok) {
        this.setHealthCareCost(result.ok)
        this.hideModal()
      } else {
        ;(this.$refs.expenseForm as typeof ExpenseForm).loading = false
      }
    },
    async deleteExpense(_id: string) {
      const result = await this.$root.deleter(this.endpointPrefix + 'healthCareCost/expense', { _id, parentId: this._id })
      if (result) {
        this.setHealthCareCost(result)
        this.hideModal()
      }
    },
    async getHealthCareCost() {
      const params: any = {
        _id: this._id,
        additionalFields: ['expenses']
      }
      const result = (await this.$root.getter<HealthCareCost>(this.endpointPrefix + 'healthCareCost', params)).ok
      if (result) {
        this.setHealthCareCost(result.data)
      }
    },
    setHealthCareCost(healthCareCost: HealthCareCost) {
      this.healthCareCost = healthCareCost
      this.addUp = addUp(this.healthCareCost)
      log(this.$t('labels.healthCareCost') + ':')
      log(this.healthCareCost)
    },
    async getExaminerMails() {
      const result = (await this.$root.getter<UserSimple[]>('healthCareCost/examiner')).ok
      if (result) {
        return result.data.map((x) => x.email)
      }
      return []
    },
    getMoneyString,
    datetoDateString
  },
  async created() {
    await this.$root.load()
    if (this.endpointPrefix === 'examine/') {
      const result = (await this.$root.getter<Organisation[]>('examine/healthCareCost/organisation')).ok
      if (result) {
        this.organisations = result.data
      }
    }
    try {
      await this.getHealthCareCost()
    } catch (e) {
      return this.$router.push({ path: this.parentPages[this.parentPages.length - 1].link })
    }
    this.isReadOnly = ['underExamination', 'underExaminationByInsurance', 'refunded'].indexOf(this.healthCareCost.state) !== -1
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
