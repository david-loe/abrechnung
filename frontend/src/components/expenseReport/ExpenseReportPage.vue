<template>
  <div>
    <ModalComponent @hideModal="hideModal()">
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
                :expense="modalExpense as Partial<Expense> | undefined"
                :disabled="isReadOnly"
                :mode="modalMode"
                :endpointPrefix="endpointPrefix"
                :ownerId="endpointPrefix === 'examine/' ? expenseReport.owner._id : undefined"
                @add="postExpense"
                @edit="postExpense"
                @deleted="deleteExpense"
                @cancel="hideModal">
              </ExpenseForm>
            </div>
          </div>
        </div>
      </div>
    </ModalComponent>
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
          {{ expenseReport.owner.name.givenName + ' ' + expenseReport.owner.name.familyName + ' - ' + expenseReport.project.identifier }}
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
                <td>{{ $formatter.simpleDate(expense.cost.date) }}</td>
                <td>{{ expense.description }}</td>
                <td>{{ $formatter.money(expense.cost) }}</td>
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
                    <template v-if="expenseReport.advance.amount">
                      <tr>
                        <td>
                          <small>{{ $t('labels.expenses') }}</small>
                        </td>
                        <td class="text-end">
                          <small>{{ $formatter.money(addUp.expenses) }}</small>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <small>{{ $t('labels.advance') }}</small>
                        </td>
                        <td class="text-end">
                          <small>{{ $formatter.money(addUp.advance, { func: (x) => 0 - x }) }}</small>
                        </td>
                      </tr>
                    </template>

                    <tr>
                      <th>{{ $t('labels.total') }}</th>
                      <td class="text-end">{{ $formatter.money(addUp.total) }}</td>
                    </tr>
                    <tr v-if="expenseReport.project.budget && expenseReport.project.budget.amount">
                      <td>
                        <small>{{ $t('labels.project') }}</small>
                      </td>
                      <td class="text-end">
                        <small>{{
                          $formatter.money(expenseReport.project.balance) + ' von ' + $formatter.money(expenseReport.project.budget)
                        }}</small>
                      </td>
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
                <div v-if="expenseReport.state === 'inWork'" style="width: max-content; position: relative">
                  <div
                    :data-bs-title="$t('alerts.noData.expense')"
                    ref="tooltip"
                    tabindex="0"
                    style="width: 100%; height: 100%; position: absolute"
                    :class="expenseReport.expenses.length < 1 ? 'visible;' : 'invisible'"></div>

                  <button
                    @click="isReadOnly ? null : toExamination()"
                    class="btn btn-primary"
                    :disabled="expenseReport.expenses.length < 1 || isReadOnly"
                    style="min-width: max-content">
                    <i class="bi bi-pencil-square"></i>
                    <span class="ms-1">{{ $t('labels.toExamination') }}</span>
                  </button>
                </div>

                <a
                  v-if="expenseReport.state === 'refunded'"
                  class="btn btn-primary"
                  :href="reportLink()"
                  :download="expenseReport.name + '.pdf'">
                  <i class="bi bi-download"></i>
                  <span class="ms-1">{{ $t('labels.downloadX', { X: $t('labels.report') }) }}</span>
                </a>
                <button v-else-if="endpointPrefix === 'examine/'" class="btn btn-success mb-2" @click="refund()">
                  <i class="bi bi-coin"></i>
                  <span class="ms-1">{{ $t('labels.refund') }}</span>
                </button>
                <button
                  v-if="expenseReport.state === 'underExamination'"
                  class="btn btn-secondary"
                  @click="expenseReport.editor._id !== expenseReport.owner._id ? null : backToInWork()"
                  :disabled="expenseReport.editor._id !== expenseReport.owner._id">
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
import { Modal, Tooltip } from 'bootstrap'
import { PropType, defineComponent } from 'vue'
import { log } from '../../../../common/logger.js'
import { addUp, mailToLink, msTeamsToLink } from '../../../../common/scripts.js'
import { BaseCurrencyMoney, Expense, ExpenseReport, UserSimple, baseCurrency, expenseReportStates } from '../../../../common/types.js'
import ModalComponent from '../elements/ModalComponent.vue'
import StatePipeline from '../elements/StatePipeline.vue'
import ExpenseForm from './forms/ExpenseForm.vue'

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
      msTeamsToLink: '',
      addUp: {} as { total: BaseCurrencyMoney; advance: BaseCurrencyMoney; expenses: BaseCurrencyMoney },
      baseCurrency,
      tooltip: undefined as Tooltip | undefined
    }
  },
  components: { StatePipeline, ExpenseForm, ModalComponent },
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
      const result = await this.$root.deleter(this.endpointPrefix + 'expenseReport', { _id: this._id })
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
    async backToInWork() {
      const result = await this.$root.setter<ExpenseReport>(this.endpointPrefix + 'expenseReport/inWork', {
        _id: this.expenseReport._id,
        comment: this.expenseReport.comment
      })
      if (result.ok) {
        if (this.endpointPrefix === 'examine/') {
          this.$router.push({ path: '/examine/expenseReport' })
        } else {
          this.setExpenseReport(result.ok)
          this.isReadOnly = ['underExamination', 'refunded'].indexOf(this.expenseReport.state) !== -1
        }
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
      return import.meta.env.VITE_BACKEND_URL + '/' + this.endpointPrefix + 'expenseReport/report?_id=' + this.expenseReport._id
    },
    async postExpense(expense: Expense) {
      var headers = {}
      if (expense.cost.receipts) {
        headers = {
          'Content-Type': 'multipart/form-data'
        }
      }
      const result = await this.$root.setter<ExpenseReport>(this.endpointPrefix + 'expenseReport/expense', expense, {
        headers,
        params: { parentId: this.expenseReport._id }
      })
      if (result.ok) {
        this.setExpenseReport(result.ok)
        this.hideModal()
      } else {
        ;(this.$refs.expenseForm as typeof ExpenseForm).loading = false
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
      const result = (await this.$root.getter<ExpenseReport>(this.endpointPrefix + 'expenseReport', params)).ok
      if (result) {
        this.setExpenseReport(result.data)
      }
    },
    setExpenseReport(expenseReport: ExpenseReport) {
      this.expenseReport = expenseReport
      this.addUp = addUp(this.expenseReport)
      log(this.$t('labels.expenseReport') + ':')
      log(this.expenseReport)
    },
    async getExaminerMails() {
      const result = (await this.$root.getter<UserSimple[]>('expenseReport/examiner')).ok
      if (result) {
        return result.data.map((x) => x.email)
      }
      return []
    }
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
    console.log(this.expenseReport.editor._id !== this.$root.user._id)
    console.log(this.$root.user._id)
    console.log(this.expenseReport.editor._id)
    if (this.$refs.tooltip) {
      this.tooltip = new Tooltip(this.$refs.tooltip as Element)
    }
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
