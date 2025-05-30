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
          :show-next-button="modalMode === 'edit' && Boolean(getNext(modalObject as Expense))"
          :show-prev-button="modalMode === 'edit' && Boolean(getPrev(modalObject as Expense))"
          @add="postExpense"
          @edit="postExpense"
          @deleted="deleteExpense"
          @cancel="resetAndHide"
          @next="() => {const next = getNext(modalObject as Expense); if(next){showModal('edit', 'expense', next)}else{hideModal()}}"
          @prev="() => {const prev = getPrev(modalObject as Expense); if(prev){showModal('edit', 'expense', prev)}else{hideModal()}}">
        </ExpenseForm>
        <ExpenseReportForm
          v-else
          :mode="modalMode"
          :expenseReport="(modalObject as Partial<ExpenseReportSimple>)"
          :loading="modalFormIsLoading"
          :owner="expenseReport.owner"
          :update-user-org="endpointPrefix !== 'examine/'"
          :endpoint-prefix="endpointPrefix"
          @cancel="resetAndHide()"
          @edit="editExpenseReportDetails">
        </ExpenseReportForm>
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
                :style="expenseReport.category.style"></Badge>
            </div>
          </div>
          <div class="col-auto">
            <div class="dropdown">
              <a class="nav-link link-body-emphasis" data-bs-toggle="dropdown" data-bs-auto-close="outside" href="#" role="button">
                <i class="bi bi-three-dots-vertical fs-3"></i>
              </a>
              <ul class="dropdown-menu dropdown-menu-end">
                <template v-if="endpointPrefix === 'examine/' && expenseReport.state !== 'refunded'">
                  <li>
                    <div class="ps-3">
                      <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" role="switch" id="editExpenseReport" v-model="isReadOnlySwitchOn" />
                        <label class="form-check-label text-nowrap" for="editExpenseReport">
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
                  <a
                    :class="'dropdown-item' + (isReadOnly ? ' disabled' : '')"
                    href="#"
                    @click="showModal('edit', 'expenseReport', expenseReport)">
                    <span class="me-1"><i class="bi bi-pencil"></i></span>
                    <span>{{ t('labels.editX', { X: t('labels.XDetails', { X: t('labels.expenseReport') }) }) }}</span>
                  </a>
                </li>
                <li>
                  <a
                    :class="
                      'dropdown-item' +
                      (isReadOnly && endpointPrefix === 'examine/' && expenseReport.state !== 'refunded' ? ' disabled' : '')
                    "
                    href="#"
                    @click="
                      isReadOnly && endpointPrefix === 'examine/' && expenseReport.state !== 'refunded' ? null : deleteExpenseReport()
                    ">
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
            (endpointPrefix === 'examine/' ? expenseReport.owner.name.givenName + ' ' + expenseReport.owner.name.familyName + ' - ' : '') +
            expenseReport.project.identifier +
            (expenseReport.project.name ? ' ' + expenseReport.project.name : '')
          }}
        </div>
      </div>

      <StatePipeline class="mb-3" :state="expenseReport.state" :states="expenseReportStates"></StatePipeline>

      <div class="row row justify-content-between">
        <div class="col-lg-auto col-12">
          <div class="row g-1 mb-3">
            <div class="col-auto">
              <button class="btn btn-secondary" @click="isReadOnly ? null : showModal('add', 'expense', undefined)" :disabled="isReadOnly">
                <i class="bi bi-plus-lg"></i>
                <span class="ms-1 d-none d-md-inline">{{ t('labels.addX', { X: t('labels.expense') }) }}</span>
                <span class="ms-1 d-md-none">{{ t('labels.expense') }}</span>
              </button>
            </div>
          </div>
          <div v-if="expenseReport.expenses.length == 0" class="alert alert-light" role="alert">
            {{ t('alerts.noData.expense') }}
          </div>
          <table v-else class="table">
            <thead>
              <tr>
                <th scope="col">{{ t('labels.date') }}</th>
                <th scope="col">{{ t('labels.description') }}</th>
                <th scope="col">{{ t('labels.amount') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="expense of expenseReport.expenses"
                :key="expense._id"
                style="cursor: pointer"
                @click="showModal('edit', 'expense', expense)">
                <td>{{ formatter.simpleDate(expense.cost.date) }}</td>
                <td>{{ expense.description }}</td>
                <td>{{ formatter.money(expense.cost) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="col-lg-4 col">
          <div class="card">
            <div class="card-body">
              <h5 class="card-title">{{ t('labels.summary') }}</h5>
              <div>
                <AddUpTable
                  :add-up="expenseReport.addUp"
                  :project="expenseReport.project"
                  :showAdvanceOverflow="expenseReport.state !== 'refunded'"></AddUpTable>
                <div v-if="expenseReport.comments.length > 0" class="mb-3 p-2 pb-0 bg-light-subtle">
                  <small>
                    <p v-for="comment of expenseReport.comments" :key="comment._id">
                      <span class="fw-bold">{{ comment.author.name.givenName + ': ' }}</span>
                      <span>{{ comment.text }}</span>
                    </p>
                  </small>
                </div>
                <div v-if="expenseReport.state !== 'refunded'" class="mb-3">
                  <label for="comment" class="form-label">{{ t('labels.comment') }}</label>
                  <TextArea
                    id="comment"
                    v-model="expenseReport.comment as string | undefined"
                    :disabled="isReadOnly && !(endpointPrefix === 'examine/' && expenseReport.state === 'underExamination')"></TextArea>
                </div>
                <div v-if="endpointPrefix === 'examine/'" class="mb-3">
                  <label for="bookingRemark" class="form-label">{{ t('labels.bookingRemark') }}</label>
                  <TextArea
                    id="bookingRemark"
                    v-model="expenseReport.bookingRemark"
                    :disabled="isReadOnly && !(endpointPrefix === 'examine/' && expenseReport.state === 'underExamination')"></TextArea>
                </div>
                <div v-if="expenseReport.state === 'inWork'">
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
                <template v-else-if="expenseReport.state === 'underExamination'">
                  <div class="mb-2" v-if="endpointPrefix === 'examine/'">
                    <button class="btn btn-success" @click="refund()">
                      <i class="bi bi-coin"></i>
                      <span class="ms-1">{{ t('labels.refund') }}</span>
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
                <div v-else-if="expenseReport.state === 'refunded'">
                  <a class="btn btn-primary" :href="reportLink" :download="expenseReport.name + '.pdf'">
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
  </div>
</template>

<script lang="ts" setup>
import { Expense, ExpenseReport, ExpenseReportSimple, UserSimple, expenseReportStates } from '@/../../common/types.js'
import API from '@/api.js'
import APP_LOADER from '@/appData'
import AddUpTable from '@/components/elements/AddUpTable.vue'
import Badge from '@/components/elements/Badge.vue'
import HelpButton from '@/components/elements/HelpButton.vue'
import ModalComponent from '@/components/elements/ModalComponent.vue'
import StatePipeline from '@/components/elements/StatePipeline.vue'
import TextArea from '@/components/elements/TextArea.vue'
import TooltipElement from '@/components/elements/TooltipElement.vue'
import ExpenseForm from '@/components/expenseReport/forms/ExpenseForm.vue'
import ExpenseReportForm from '@/components/expenseReport/forms/ExpenseReportForm.vue'
import { formatter } from '@/formatter.js'
import { logger } from '@/logger.js'
import { PropType, computed, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

type ModalObject = Partial<Expense> | ExpenseReportSimple
type ModalObjectType = 'expense' | 'expenseReport'
type ModalMode = 'add' | 'edit'

const props = defineProps({
  _id: { type: String, required: true },
  parentPages: { type: Array as PropType<{ link: string; title: string }[]>, required: true },
  endpointPrefix: { type: String, default: '' }
})

const router = useRouter()
const { t } = useI18n()

const expenseReport = ref<ExpenseReport>({} as ExpenseReport)
const modalObject = ref<ModalObject>({})
const modalMode = ref<ModalMode>('add')
const modalObjectType = ref<ModalObjectType>('expense')

const isReadOnlySwitchOn = ref(true)
const modalFormIsLoading = ref(false)

const isReadOnly = computed(() => {
  return (
    (expenseReport.value.state === 'underExamination' ||
      expenseReport.value.state === 'refunded' ||
      (expenseReport.value.state === 'inWork' && props.endpointPrefix === 'examine/')) &&
    isReadOnlySwitchOn.value
  )
})

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
    router.push({ path: '/' })
  }
}

async function toExamination() {
  const result = await API.setter<ExpenseReport>(`${props.endpointPrefix}expenseReport/underExamination`, {
    _id: expenseReport.value._id,
    comment: expenseReport.value.comment
  })
  if (result.ok) {
    router.push({ path: '/' })
  }
}

async function backToInWork() {
  const result = await API.setter<ExpenseReport>(`${props.endpointPrefix}expenseReport/inWork`, {
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

async function refund() {
  const result = await API.setter<ExpenseReport>('examine/expenseReport/refunded', {
    _id: expenseReport.value._id,
    comment: expenseReport.value.comment,
    bookingRemark: expenseReport.value.bookingRemark
  })
  if (result.ok) {
    router.push({ path: '/examine/expenseReport' })
  }
}

async function postExpense(expense: Expense) {
  let headers: Record<string, string> = {}
  if (expense.cost.receipts) {
    headers = { 'Content-Type': 'multipart/form-data' }
  }
  modalFormIsLoading.value = true
  const result = await API.setter<ExpenseReport>(`${props.endpointPrefix}expenseReport/expense`, expense, {
    headers,
    params: { parentId: expenseReport.value._id }
  })
  modalFormIsLoading.value = false
  if (result.ok) {
    setExpenseReport(result.ok)
    resetAndHide()
  } else {
  }
}

async function deleteExpense(_id: string) {
  modalFormIsLoading.value = true
  const result = await API.deleter(`${props.endpointPrefix}expenseReport/expense`, { _id, parentId: props._id })
  modalFormIsLoading.value = false
  if (result) {
    setExpenseReport(result)
    resetAndHide()
  }
}

async function editExpenseReportDetails(updatedExpenseReport: ExpenseReport) {
  modalFormIsLoading.value = true
  const result = await API.setter<ExpenseReport>(
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
  const params: any = {
    _id: props._id,
    additionalFields: ['expenses']
  }
  const response = await API.getter<ExpenseReport>(`${props.endpointPrefix}expenseReport`, params)
  const result = response.ok
  if (result) {
    setExpenseReport(result.data)
  }
}

function setExpenseReport(er: ExpenseReport) {
  expenseReport.value = er
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

function getNext(expense: Expense): Expense | undefined {
  const index = expenseReport.value.expenses.findIndex((e) => e._id === expense._id)
  if (index === -1 || index + 1 === expenseReport.value.expenses.length) {
    return undefined
  }
  return expenseReport.value.expenses[index + 1]
}

function getPrev(expense: Expense): Expense | undefined {
  const index = expenseReport.value.expenses.findIndex((e) => e._id === expense._id)
  if (index === -1 || index === 0) {
    return undefined
  }
  return expenseReport.value.expenses[index - 1]
}

try {
  await getExpenseReport()
} catch (e) {
  router.push({ path: props.parentPages[props.parentPages.length - 1].link })
}
const examinerMails = await getExaminerMails()

const reportLink = `${import.meta.env.VITE_BACKEND_URL}/${props.endpointPrefix}expenseReport/report?_id=${expenseReport.value._id}`
</script>
<style></style>
