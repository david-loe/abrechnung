<template>
  <div>
    <ModalComponent
      ref="modalComp"
      :header="
        modalMode === 'add'
          ? t('labels.newX', { X: t('labels.' + modalObjectType) })
          : t('labels.editX', { X: t('labels.' + modalObjectType) })
      "
      @afterClose="modalMode === 'edit' ? resetModal() : null">
      <div v-if="expenseReport._id">
        <ExpenseForm
          v-if="modalObjectType === 'expense'"
          :expense="modalObject"
          :disabled="isReadOnly"
          :loading="modalFormIsLoading"
          :mode="modalMode"
          :endpointPrefix="endpointPrefix"
          :ownerId="endpointPrefix === 'examine/' ? expenseReport.owner._id : undefined"
          :show-next-button="modalMode === 'edit' && Boolean(getNext(modalObject as Expense<string>))"
          :show-prev-button="modalMode === 'edit' && Boolean(getPrev(modalObject as Expense<string>))"
          @add="postExpense"
          @edit="postExpense"
          @deleted="deleteExpense"
          @cancel="resetAndHide"
          @next="() => {const next = getNext(modalObject as Expense<string>); if(next){showModal('edit', 'expense', next)}else{hideModal()}}"
          @prev="() => {const prev = getPrev(modalObject as Expense<string>); if(prev){showModal('edit', 'expense', prev)}else{hideModal()}}" />
        <ExpenseReportForm
          v-else
          :mode="modalMode"
          :expenseReport="(modalObject as Partial<ExpenseReportSimple<string>>)"
          :loading="modalFormIsLoading"
          :owner="expenseReport.owner"
          :update-user-org="endpointPrefix !== 'examine/'"
          :endpoint-prefix="endpointPrefix"
          @cancel="resetAndHide()"
          @edit="editExpenseReportDetails" />
      </div>
    </ModalComponent>
    <div class="container py-3" v-if="expenseReport._id">
      <div class="row">
        <div class="col">
          <nav v-if="parentPages && parentPages.length > 0" aria-label="breadcrumb">
            <ol class="breadcrumb">
              <li class="breadcrumb-item" v-for="page of parentPages" :key="page.link">
                <router-link :to="page.link">{{ t(page.title) }}</router-link>
              </li>
              <li class="breadcrumb-item active" aria-current="page">{{ expenseReport.name }}</li>
            </ol>
          </nav>
        </div>
        <div class="col-auto">
          <HelpButton :examinerMails="examinerMails" />
        </div>
      </div>

      <div class="mb-2">
        <div class="row justify-content-between align-items-end">
          <div class="col-auto d-flex align-items-center">
            <h2 class="m-0">{{ expenseReport.name }}</h2>
            <div>
              <Badge
                v-if="APP_DATA?.categories && APP_DATA?.categories.length > 1"
                class="ms-2 fs-6"
                :text="expenseReport.category.name"
                :style="expenseReport.category.style" />
            </div>
          </div>
          <div class="col-auto">
            <div class="dropdown">
              <a class="nav-link link-body-emphasis" data-bs-toggle="dropdown" data-bs-auto-close="outside" href="#" role="button">
                <i class="bi bi-three-dots-vertical fs-3"></i>
              </a>
              <ul class="dropdown-menu dropdown-menu-end">
                <template v-if="endpointPrefix === 'examine/' && expenseReport.state < State.BOOKABLE">
                  <li>
                    <div class="ps-3">
                      <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" role="switch" id="editExpenseReport" v-model="isReadOnlySwitchOn" >
                        <label class="form-check-label text-nowrap" for="editExpenseReport">
                          <span class="me-1"
                            ><i class="bi bi-lock"></i></span
                          >
                          <span>{{ t('labels.readOnly') }}</span>
                        </label>
                      </div>
                    </div>
                  </li>
                  <li>
                    <hr class="dropdown-divider" >
                  </li>
                </template>
                <li>
                  <a
                    :class="'dropdown-item' + (isReadOnly ? ' disabled' : '')"
                    href="#"
                    @click="showModal('edit', 'expenseReport', expenseReport)">
                    <span class="me-1"
                      ><i class="bi bi-pencil"></i></span
                    >
                    <span>{{ t('labels.editX', { X: t('labels.XDetails', { X: t('labels.expenseReport') }) }) }}</span>
                  </a>
                </li>
                <li>
                  <a
                    :class="
                      'dropdown-item' +
                      (isReadOnly && endpointPrefix === 'examine/' && expenseReport.state < State.BOOKABLE ? ' disabled' : '')
                    "
                    href="#"
                    @click="
                      isReadOnly && endpointPrefix === 'examine/' && expenseReport.state < State.BOOKABLE ? null : deleteExpenseReport()
                    ">
                    <span class="me-1"
                      ><i class="bi bi-trash"></i></span
                    >
                    <span>{{ t('labels.delete') }}</span>
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div class="text-secondary">
          {{
            (endpointPrefix === 'examine/' ? formatter.name(expenseReport.owner.name) + ' - ' : '') +
            expenseReport.project.identifier +
            (expenseReport.project.name ? ' ' + expenseReport.project.name : '')
          }}
        </div>
      </div>

      <StatePipeline class="mb-3" :state="expenseReport.state" :StateEnum="ExpenseReportState" />

      <div class="row justify-content-between">
        <div class="col-lg-8 col-12">
          <div class="row mb-3">
            <div class="col-auto">
              <button class="btn btn-secondary" @click="isReadOnly ? null : showModal('add', 'expense', undefined)" :disabled="isReadOnly">
                <i class="bi bi-plus-lg"></i>
                <span class="ms-1 d-none d-md-inline">{{ t('labels.addX', { X: t('labels.expense') }) }}</span>
                <span class="ms-1 d-md-none">{{ t('labels.expense') }}</span>
              </button>
            </div>
            <div v-if="!isReadOnly" class="col-auto ms-auto">
              <CSVImport
                button-style="outline-secondary btn-sm"
                :template-fields="['cost.date', 'description', 'cost.amount', 'cost.currency', 'note']"
                :transformers="[
                  { path: 'cost.date', fn: convertGermanDateToHTMLDate },
                  { path: 'cost.currency', fn: (v) => (v ? getById(v, APP_DATA?.currencies || []) : v) },
                  { path: 'cost.amount', fn: (v) => (v ? Number.parseFloat(v) : null) }
                ]"
                @submitted="(d) => (isReadOnly ? null : addDrafts(d as ExpenseDraft[]))" />
            </div>
          </div>
          <TableElement
            :rows-items="[12, 50, 100]"
            :rows-per-page="50"
            db-key="expenseTableExpenseReport"
            :empty-message="t('alerts.noData.expense')"
            :headers="[
              { text: '', value: 'warning', width: 25 },
              { text: 'labels.date', value: 'cost.date', sortable: true },
              { text: 'labels.description', value: 'description', sortable: true },
              { text: 'labels.amount', value: 'cost' }
            ]"
            :items="allExpenses"
            :body-row-class-name="(expense, rowNum) => (expense as Expense)._id ? 'clickable' : 'table-warning clickable'"
            @click-row="(expense) => showModal('edit', 'expense', expense as Expense<string>)">
            <template #item-cost.date="{ cost }: Expense">
              {{
                new Date(cost.date).getUTCFullYear() === new Date().getUTCFullYear()
                  ? formatter.simpleDate(cost.date)
                  : formatter.date(cost.date)
              }}
            </template>
            <template #item-cost="{ cost }: Expense">
              <div class="text-end">{{ formatter.money(cost) }}</div>
            </template>
            <template #item-warning="expense: Expense">
              <span v-if="!(expense as Expense)._id" class="text-warning" :title="t('labels.draft')">
                <i class="bi bi-exclamation-triangle"></i>
              </span>
            </template>
          </TableElement>
          <div v-if="expenseReport.drafts && expenseReport.drafts.length > 0" class="row g-2 text-danger">
            <div class="col-auto">
              <i class="bi bi-exclamation-triangle"></i>
            </div>
            <div class="col">
              <span> {{ t('alerts.draftsWillBeLost') }}</span>
            </div>
          </div>
        </div>
        <div class="col-lg-4 col">
          <div class="card">
            <div class="card-body">
              <h5 class="card-title">{{ t('labels.summary') }}</h5>
              <div>
                <AddUpTable
                  :add-up="expenseReport.addUp"
                  :project="expenseReport.project"
                  :showAdvanceOverflow="expenseReport.state < State.BOOKABLE" />
                <div v-if="expenseReport.comments.length > 0" class="mb-3 p-2 pb-0 bg-light-subtle">
                  <small>
                    <p v-for="comment of expenseReport.comments" :key="comment._id">
                      <span class="fw-bold">{{ comment.author.name.givenName + ': ' }}</span>
                      <span>{{ comment.text }}</span>
                    </p>
                  </small>
                </div>
                <div v-if="expenseReport.state <= State.BOOKABLE" class="mb-3">
                  <label for="comment" class="form-label">{{ t('labels.comment') }}</label>
                  <CTextArea
                    id="comment"
                    v-model="expenseReport.comment as string | undefined"
                    :disabled="isReadOnly && !(endpointPrefix === 'examine/' && expenseReport.state === State.IN_REVIEW)" />
                </div>
                <div v-if="endpointPrefix === 'examine/'" class="mb-3">
                  <label for="bookingRemark" class="form-label">{{ t('labels.bookingRemark') }}</label>
                  <CTextArea
                    id="bookingRemark"
                    v-model="expenseReport.bookingRemark"
                    :disabled="isReadOnly && !(endpointPrefix === 'examine/' && expenseReport.state === State.IN_REVIEW)" />
                </div>
                <div v-if="expenseReport.state === State.EDITABLE_BY_OWNER">
                  <TooltipElement v-if="expenseReport.expenses.length < 1" :text="t('alerts.noData.expense')">
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
                <template v-else-if="expenseReport.state === State.IN_REVIEW">
                  <div v-if="endpointPrefix === 'examine/'" class="mb-3">
                    <button class="btn btn-success" @click="completeReview()">
                      <i class="bi bi-check2-square"></i>
                      <span class="ms-1">{{ t('labels.completeReview') }}</span>
                    </button>
                  </div>
                  <div>
                    <button
                      class="btn btn-secondary"
                      @click="expenseReport.editor._id !== expenseReport.owner._id && endpointPrefix !== 'examine/' ? null : backToInWork()"
                      :disabled="expenseReport.editor._id !== expenseReport.owner._id && endpointPrefix !== 'examine/'">
                      <i class="bi bi-arrow-counterclockwise"></i>
                      <span class="ms-1">{{ t(endpointPrefix === 'examine/' ? 'labels.backToApplicant' : 'labels.editAgain') }}</span>
                    </button>
                  </div>
                </template>
                <div v-else-if="expenseReport.state >= State.BOOKABLE">
                  <button
                    class="btn btn-primary"
                    @click="
                      showFile({
                        endpoint: `${props.endpointPrefix}expenseReport/report`,
                        params: { _id: expenseReport._id },
                        filename: `${expenseReport.name}.pdf`,
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
  Currency,
  DocumentFile,
  Expense,
  ExpenseReport,
  ExpenseReportSimple,
  ExpenseReportState,
  State,
  UserSimple
} from 'abrechnung-common/types.js'
import { convertGermanDateToHTMLDate, getById } from 'abrechnung-common/utils/scripts.js'
import { computed, onBeforeUnmount, onMounted, PropType, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import API from '@/api.js'
import AddUpTable from '@/components/elements/AddUpTable.vue'
import Badge from '@/components/elements/Badge.vue'
import CSVImport from '@/components/elements/CSVImport.vue'
import HelpButton from '@/components/elements/HelpButton.vue'
import ModalComponent from '@/components/elements/ModalComponent.vue'
import StatePipeline from '@/components/elements/StatePipeline.vue'
import TableElement from '@/components/elements/TableElement.vue'
import CTextArea from '@/components/elements/TextArea.vue'
import TooltipElement from '@/components/elements/TooltipElement.vue'
import ExpenseForm from '@/components/expenseReport/forms/ExpenseForm.vue'
import ExpenseReportForm from '@/components/expenseReport/forms/ExpenseReportForm.vue'
import APP_LOADER from '@/dataLoader.js'
import { formatter } from '@/formatter.js'
import { showFile } from '@/helper.js'
import { logger } from '@/logger.js'

type ModalObject = Partial<Expense<string>> | ExpenseReportSimple<string>
type ModalObjectType = 'expense' | 'expenseReport'
type ModalMode = 'add' | 'edit'

const props = defineProps({
  _id: { type: String, required: true },
  parentPages: { type: Array as PropType<{ link: string; title: string }[]>, required: true },
  endpointPrefix: { type: String, default: '' }
})

const router = useRouter()
const { t } = useI18n()

type ExpenseDraft = {
  cost: { date: string; amount: number; currency: Currency; receipts: DocumentFile[] }
  description: string
  note?: string
  id: number
}
interface ExpenseReportWithDrafts extends ExpenseReport<string> {
  drafts?: ExpenseDraft[]
}

const expenseReport = ref<ExpenseReportWithDrafts>({} as ExpenseReport<string>)
const modalObject = ref<ModalObject>({})
const modalMode = ref<ModalMode>('add')
const modalObjectType = ref<ModalObjectType>('expense')

const isDownloading = ref('')
const isDownloadingFn = () => isDownloading

const isReadOnlySwitchOn = ref(true)
const modalFormIsLoading = ref(false)

const isReadOnly = computed(() => {
  return (
    (expenseReport.value.state > State.EDITABLE_BY_OWNER ||
      (expenseReport.value.state === State.EDITABLE_BY_OWNER && props.endpointPrefix === 'examine/')) &&
    isReadOnlySwitchOn.value
  )
})

const allExpenses = computed(() => [...expenseReport.value.expenses, ...(expenseReport.value.drafts ?? [])])

const modalCompRef = useTemplateRef('modalComp')

await APP_LOADER.loadData()
const APP_DATA = APP_LOADER.data

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
  if (modalCompRef.value?.modal) {
    modalCompRef.value.hideModal()
  }
}
function resetModal() {
  modalMode.value = 'add'
  modalObject.value = {}
}
function resetAndHide() {
  resetModal()
  hideModal()
}

async function deleteExpenseReport() {
  const result = await API.deleter(`${props.endpointPrefix}expenseReport`, { _id: props._id })
  if (result) {
    router.push({ path: '/', hash: '#skip' })
  }
}

async function toExamination() {
  if (shouldContinue()) {
    const result = await API.setter<ExpenseReport>(`${props.endpointPrefix}expenseReport/underExamination`, {
      _id: expenseReport.value._id,
      comment: expenseReport.value.comment
    })
    if (result.ok) {
      router.push({ path: '/', hash: '#skip' })
    }
  }
}

async function backToInWork() {
  const result = await API.setter<ExpenseReport<string>>(`${props.endpointPrefix}expenseReport/inWork`, {
    _id: expenseReport.value._id,
    comment: expenseReport.value.comment
  })
  if (result.ok) {
    if (props.endpointPrefix === 'examine/') {
      router.push({ path: '/examine/expenseReport' })
    } else {
      setExpenseReport(result.ok)
    }
  }
}

async function completeReview() {
  if (confirm(t('alerts.areYouSureCompleteReview'))) {
    const result = await API.setter<ExpenseReport<string>>('examine/expenseReport/reviewCompleted', {
      _id: expenseReport.value._id,
      comment: expenseReport.value.comment,
      bookingRemark: expenseReport.value.bookingRemark
    })
    if (result.ok) {
      setExpenseReport(result.ok)
    }
  }
}

async function postExpense(expense: Partial<Expense>) {
  let headers: Record<string, string> = {}
  if (expense.cost?.receipts) {
    headers = { 'Content-Type': 'multipart/form-data' }
  }
  modalFormIsLoading.value = true
  const result = await API.setter<ExpenseReport<string>>(`${props.endpointPrefix}expenseReport/expense`, expense, {
    headers,
    params: { parentId: expenseReport.value._id }
  })
  modalFormIsLoading.value = false
  if (result.ok) {
    const draftIndex = expenseReport.value.drafts?.findIndex((d) => d.id === (expense as unknown as ExpenseDraft).id)
    if (draftIndex !== undefined && draftIndex !== -1) {
      expenseReport.value.drafts?.splice(draftIndex, 1)
    }
    setExpenseReport(result.ok)
    resetAndHide()
  } else {
  }
}

async function deleteExpense(_id?: string) {
  if (_id) {
    modalFormIsLoading.value = true
    const result = await API.deleter(`${props.endpointPrefix}expenseReport/expense`, { _id, parentId: props._id })
    modalFormIsLoading.value = false
    if (result) {
      setExpenseReport(result as ExpenseReport<string>)
      resetAndHide()
    }
  }
}

async function editExpenseReportDetails(updatedExpenseReport: Partial<ExpenseReport>) {
  modalFormIsLoading.value = true
  const result = await API.setter<ExpenseReport<string>>(
    `${props.endpointPrefix}expenseReport${props.endpointPrefix === 'examine/' ? '' : '/inWork'}`,
    updatedExpenseReport
  )
  modalFormIsLoading.value = false
  if (result.ok) {
    setExpenseReport(result.ok)
    resetAndHide()
  } else {
    await getExpenseReport()
  }
}

async function getExpenseReport() {
  const params = { _id: props._id, additionalFields: ['expenses'] }
  const response = await API.getter<ExpenseReport<string>>(`${props.endpointPrefix}expenseReport`, params)
  const result = response.ok
  if (result) {
    setExpenseReport(result.data)
  }
}

function setExpenseReport(er: ExpenseReport<string>) {
  const drafts = expenseReport.value.drafts || []
  expenseReport.value = er
  expenseReport.value.drafts = drafts
  logger.info(`${t('labels.expenseReport')}:`)
  logger.info(expenseReport.value)
}

async function getExaminerMails(): Promise<string[]> {
  const response = await API.getter<UserSimple[]>('expenseReport/examiner')
  const result = response.ok
  if (result) {
    return result.data.map((x) => x.email)
  }
  return []
}

function getNext(expense: Expense<string>): Expense<string> | undefined {
  const index = expenseReport.value.expenses.findIndex((e) => e._id === expense._id)
  if (index === -1 || index + 1 === expenseReport.value.expenses.length) {
    return undefined
  }
  return expenseReport.value.expenses[index + 1]
}

function getPrev(expense: Expense<string>): Expense<string> | undefined {
  const index = expenseReport.value.expenses.findIndex((e) => e._id === expense._id)
  if (index === -1 || index === 0) {
    return undefined
  }
  return expenseReport.value.expenses[index - 1]
}

function addDrafts(draftExpenses: ExpenseDraft[]) {
  for (const draft of draftExpenses) {
    draft.cost.receipts = []
    draft.id = Math.random()
  }

  if (!expenseReport.value.drafts) {
    expenseReport.value.drafts = []
  }
  expenseReport.value.drafts.push(...draftExpenses)
}

function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (expenseReport.value.drafts && expenseReport.value.drafts.length > 0) {
    e.preventDefault()
  }
}
onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload)
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

onBeforeRouteLeave((to, _from, next) => {
  if (to.hash === '#skip') {
    to.hash = ''
    next()
    return
  }
  next(shouldContinue())
})

function shouldContinue(): boolean {
  if (expenseReport.value.drafts && expenseReport.value.drafts.length > 0) {
    return confirm(t('alerts.unsavedChanges'))
  }
  return true
}

try {
  await getExpenseReport()
} catch (e) {
  router.push({ path: props.parentPages[props.parentPages.length - 1].link })
}
const examinerMails = await getExaminerMails()
</script>
<style></style>
