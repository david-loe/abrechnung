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
          <div v-if="expenseReport._id" class="modal-body">
            <ExpenseForm
              ref="expenseForm"
              :expense="(modalExpense as Partial<Expense> | undefined)"
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
    <div class="container" v-if="expenseReport._id">
      <div class="row">
        <div class="col">
          <nav v-if="parentPages && parentPages.length > 0" aria-label="breadcrumb">
            <ol class="breadcrumb">
              <li class="breadcrumb-item" v-for="page of parentPages" :key="page.link">
                <router-link :to="page.link">{{ $t(page.title) }}</router-link>
              </li>
              <li class="breadcrumb-item active" aria-current="page">{{ expenseReport.name }}</li>
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
            <h1 class="m-0">{{ expenseReport.name }}</h1>
          </div>
          <div class="col-auto">
            <div class="dropdown">
              <a class="nav-link link-dark" data-bs-toggle="dropdown" data-bs-auto-close="outside" href="#" role="button">
                <i class="bi bi-three-dots-vertical fs-3"></i>
              </a>
              <ul class="dropdown-menu dropdown-menu-end">
                <template v-if="endpointPrefix === 'examine/' && expenseReport.state !== 'refunded'">
                  <li>
                    <div class="ps-3">
                      <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" role="switch" id="editExpenseReport" v-model="isReadOnly" />
                        <label class="form-check-label text-nowrap" for="editExpenseReport">
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
                    :class="'dropdown-item' + (isReadOnly && endpointPrefix === 'examine/' ? ' disabled' : '')"
                    href="#"
                    @click="isReadOnly && endpointPrefix === 'examine/' ? null : deleteExpenseReport()">
                    <span class="me-1"><i class="bi bi-trash"></i></span>
                    <span>{{ $t('labels.delete') }}</span>
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div v-if="endpointPrefix === 'examine/'" class="text-secondary">
          {{ expenseReport.owner.name.givenName + ' ' + expenseReport.owner.name.familyName + ' - ' + expenseReport.organisation.name }}
        </div>
      </div>

      <StatePipeline class="mb-3" :state="expenseReport.state" :states="expenseReportStates"></StatePipeline>

      <div class="row row justify-content-between">
        <div class="col-lg-auto col-12">
          <div class="row g-1 mb-3">
            <div class="col-auto">
              <button class="btn btn-secondary" @click="isReadOnly ? null : showModal('add', undefined)" :disabled="isReadOnly">
                <i class="bi bi-plus-lg"></i>
                <span class="ms-1 d-none d-md-inline">{{ $t('labels.addX', { X: $t('labels.expense') }) }}</span>
                <span class="ms-1 d-md-none">{{ $t('labels.expense') }}</span>
              </button>
            </div>
          </div>
          <div v-if="expenseReport.expenses.length == 0" class="alert alert-light" role="alert">
            {{ $t('alerts.noData.expense') }}
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
              <tr v-for="expense of expenseReport.expenses" :key="expense._id" style="cursor: pointer" @click="showModal('edit', expense)">
                <td>{{ datetoDateString(expense.cost.date) }}</td>
                <td>{{ expense.description }}</td>
                <td>{{ getMoneyString(expense.cost) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="col-lg-3 col">
          <div class="card">
            <div class="card-body">
              <h5 class="card-title">{{ $t('labels.summary') }}</h5>
              <div>
                <table class="table align-bottom">
                  <tbody>
                    <tr>
                      <th>{{ $t('labels.total') }}</th>
                      <td class="text-end">{{ getMoneyString(getExpenseReportTotal(expenseReport)) }}</td>
                    </tr>
                  </tbody>
                </table>
                <div v-if="expenseReport.comments.length > 0" class="mb-3 p-2 pb-0 bg-light-subtle">
                  <small>
                    <p v-for="comment of expenseReport.comments" :key="comment._id">
                      <span class="fw-bold">{{ comment.author.name.givenName + ': ' }}</span>
                      <span>{{ comment.text }}</span>
                    </p>
                  </small>
                </div>
                <div v-if="expenseReport.state !== 'refunded'" class="mb-3">
                  <label for="comment" class="form-label">{{ $t('labels.comment') }}</label>
                  <textarea
                    class="form-control"
                    id="comment"
                    rows="1"
                    v-model="expenseReport.comment as string | undefined"
                    :disabled="isReadOnly && endpointPrefix !== 'examine/'"></textarea>
                </div>
                <button
                  v-if="expenseReport.state === 'inWork'"
                  class="btn btn-primary"
                  @click="isReadOnly ? null : toExamination()"
                  :disabled="isReadOnly || expenseReport.expenses.length < 1">
                  <i class="bi bi-pencil-square"></i>
                  <span class="ms-1">{{ $t('labels.toExamination') }}</span>
                </button>
                <a
                  v-if="expenseReport.state === 'refunded'"
                  class="btn btn-primary"
                  :href="reportLink()"
                  :download="expenseReport.name + '.pdf'">
                  <i class="bi bi-download"></i>
                  <span class="ms-1">{{ $t('labels.downloadX', { X: $t('labels.report') }) }}</span>
                </a>
                <button v-else-if="endpointPrefix === 'examine/'" class="btn btn-success" @click="refund()">
                  <i class="bi bi-coin"></i>
                  <span class="ms-1">{{ $t('labels.refund') }}</span>
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
import { defineComponent, PropType } from 'vue'
import { Modal } from 'bootstrap'
import StatePipeline from '../elements/StatePipeline.vue'
import ExpenseForm from './forms/ExpenseForm.vue'
import { getMoneyString, datetoDateString, getExpenseReportTotal, mailToLink, msTeamsToLink } from '../../../../common/scripts.js'
import { log } from '../../../../common/logger.js'
import { ExpenseReport, expenseReportStates, Expense, UserSimple } from '../../../../common/types.js'

type ModalMode = 'add' | 'edit'

export default defineComponent({
  name: 'ExpenseReportPage',
  data() {
    return {
      expenseReport: {} as ExpenseReport,
      modal: undefined as Modal | undefined,
      modalExpense: undefined as Expense | undefined,
      modalMode: 'add' as ModalMode,
      isReadOnly: false,
      expenseReportStates,
      mailToLink: '',
      msTeamsToLink: ''
    }
  },
  components: { StatePipeline, ExpenseForm },
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
    async deleteExpenseReport() {
      const result = await this.$root.deleter(this.endpointPrefix + 'expenseReport', {_id: this._id} )
      if (result) {
        this.$router.push({ path: '/' })
      }
    },
    async toExamination() {
      const result = await this.$root.setter<ExpenseReport>('expenseReport/underExamination', {
        _id: this.expenseReport._id,
        comment: this.expenseReport.comment
      })
      if (result.ok) {
        this.$router.push({ path: '/' })
      }
    },
    async refund() {
      const result = await this.$root.setter<ExpenseReport>('examine/expenseReport/refunded', {
        _id: this.expenseReport._id,
        comment: this.expenseReport.comment
      })
      if (result.ok) {
        this.$router.push({ path: '/examine/expenseReport' })
      }
    },
    reportLink() {
      return import.meta.env.VITE_BACKEND_URL + '/api/' + this.endpointPrefix + 'expenseReport/report?id=' + this.expenseReport._id
    },
    async postExpense(expense: Expense) {
      var headers = {}
      if (expense.cost.receipts) {
        headers = {
          'Content-Type': 'multipart/form-data'
        }
      }
      const result = await this.$root.setter<ExpenseReport>(this.endpointPrefix + 'expenseReport/expense', expense, { headers, params: {parentId: this.expenseReport._id} })
      if (result.ok) {
        this.setExpenseReport(result.ok)
        this.hideModal()
      }
    },
    async deleteExpense(_id: string) {
      const result = await this.$root.deleter(this.endpointPrefix + 'expenseReport/expense', { _id, parentId: this._id })
      if (result) {
        this.setExpenseReport(result)
        this.hideModal()
      }
    },
    async getExpenseReport() {
      const params: any = {
        _id: this._id,
        additionalFields: ['expenses']
      }
      if (this.endpointPrefix === 'examine/') {
        params.addRefunded = true
      }
      const result = (await this.$root.getter<ExpenseReport>(this.endpointPrefix + 'expenseReport', params)).ok
      if(result){
        this.setExpenseReport(result.data)
      }
    },
    setExpenseReport(expenseReport: ExpenseReport){
      this.expenseReport = expenseReport
      log(this.$t('labels.expenseReport') + ':')
      log(this.expenseReport)
    },
    async getExaminerMails() {
      const result = (await this.$root.getter<UserSimple[]>('expenseReport/examiner')).ok
      if (result) {
        return result.data.map((x) => x.email)
      }
      return []
    },
    getMoneyString,
    datetoDateString,
    getExpenseReportTotal
  },
  async created() {
    await this.$root.load()
    try {
      await this.getExpenseReport()
    } catch (e) {
      return this.$router.push({ path: this.parentPages[this.parentPages.length - 1].link })
    }
    this.isReadOnly = ['underExamination', 'refunded'].indexOf(this.expenseReport.state) !== -1
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
