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
      <div v-if="healthCareCost._id">
        <ExpenseForm
          v-if="modalObjectType === 'expense'"
          :expense="modalObject as Partial<Expense>"
          :disabled="isReadOnly"
          :loading="modalFormIsLoading"
          :mode="modalMode"
          :endpointPrefix="endpointPrefix"
          :ownerId="endpointPrefix === 'examine/' ? healthCareCost.owner._id : undefined"
          :show-next-button="modalMode === 'edit' && Boolean(getNext(modalObject as Expense))"
          :show-prev-button="modalMode === 'edit' && Boolean(getPrev(modalObject as Expense))"
          @add="postExpense"
          @edit="postExpense"
          @deleted="deleteExpense"
          @cancel="resetAndHide"
          @next="() => { const next = getNext(modalObject as Expense); if (next) { showModal('edit', 'expense', next) } else { hideModal() } }"
          @prev="() => { const prev = getPrev(modalObject as Expense); if (prev) { showModal('edit', 'expense', prev) } else { hideModal() } }">
        </ExpenseForm>
        <HealthCareCostForm
          v-else
          :mode="(modalMode as 'add' | 'edit')"
          :healthCareCost="modalObject as HealthCareCostSimple"
          :loading="modalFormIsLoading"
          :owner="healthCareCost.owner"
          :update-user-org="endpointPrefix !== 'examine/'"
          :endpoint-prefix="endpointPrefix"
          @cancel="resetAndHide()"
          @edit="editHealthCareCostDetails">
        </HealthCareCostForm>
      </div>
    </ModalComponent>
    <div class="container py-3" v-if="healthCareCost._id">
      <div class="row">
        <div class="col">
          <nav v-if="parentPages && parentPages.length > 0" aria-label="breadcrumb">
            <ol class="breadcrumb">
              <li class="breadcrumb-item" v-for="page of parentPages" :key="page.link">
                <router-link :to="page.link">{{ t(page.title) }}</router-link>
              </li>
              <li class="breadcrumb-item active" aria-current="page">{{ healthCareCost.name }}</li>
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
            <h2 class="m-0">{{ healthCareCost.name }}</h2>
          </div>
          <div class="col-auto">
            <div class="dropdown">
              <a class="nav-link link-body-emphasis" data-bs-toggle="dropdown" data-bs-auto-close="outside" href="#" role="button">
                <i class="bi bi-three-dots-vertical fs-3"></i>
              </a>
              <ul class="dropdown-menu dropdown-menu-end">
                <template v-if="endpointPrefix === 'examine/' && healthCareCost.state < State.BOOKABLE">
                  <li>
                    <div class="ps-3">
                      <div class="form-check form-switch">
                        <input
                          class="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="editHealthCareCost"
                          v-model="isReadOnlySwitchOn" />
                        <label class="form-check-label text-nowrap" for="editHealthCareCost">
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
                    @click="showModal('edit', 'healthCareCost', healthCareCost)">
                    <span class="me-1"><i class="bi bi-pencil"></i></span>
                    <span>{{ t('labels.editX', { X: t('labels.XDetails', { X: t('labels.healthCareCost') }) }) }}</span>
                  </a>
                </li>
                <li>
                  <a
                    :class="
                      'dropdown-item' + (isReadOnly && endpointPrefix !== '' && healthCareCost.state < State.BOOKABLE ? ' disabled' : '')
                    "
                    href="#"
                    @click="isReadOnly && endpointPrefix !== '' && healthCareCost.state < State.BOOKABLE ? null : deleteHealthCareCost()">
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
            (endpointPrefix === 'examine/' ? formatter.name(healthCareCost.owner.name) + ' - ' : '') +
            healthCareCost.project.identifier +
            (healthCareCost.project.name ? ' ' + healthCareCost.project.name : '')
          }}
        </div>
      </div>

      <StatePipeline class="mb-3" :state="healthCareCost.state" :StateEnum="HealthCareCostState"></StatePipeline>

      <div class="row row justify-content-between">
        <div class="col-lg-auto col-12">
          <div class="row g-1 mb-3">
            <div class="col-auto">
              <button class="btn btn-secondary" @click="isReadOnly ? null : showModal('add', 'expense', undefined)" :disabled="isReadOnly">
                <i class="bi bi-plus-lg"></i>
                <span class="ms-1 d-none d-md-inline">{{ t('labels.addX', { X: t('labels.healthCareCost') }) }}</span>
                <span class="ms-1 d-md-none">{{ t('labels.healthCareCost') }}</span>
              </button>
            </div>
          </div>
          <div v-if="healthCareCost.expenses.length == 0" class="alert alert-light" role="alert">
            {{ t('alerts.noData.healthCareCost') }}
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
                v-for="expense of healthCareCost.expenses"
                :key="expense._id"
                style="cursor: pointer"
                @click="showModal('edit', 'expense', expense)">
                <td>
                  {{
                    new Date(expense.cost.date).getUTCFullYear() === new Date().getUTCFullYear()
                      ? formatter.simpleDate(expense.cost.date)
                      : formatter.date(expense.cost.date)
                  }}
                </td>
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
                <table class="table align-bottom">
                  <AddUpTable
                    :add-up="healthCareCost.addUp"
                    :project="healthCareCost.project"
                    :showAdvanceOverflow="healthCareCost.state < State.BOOKABLE"></AddUpTable>
                </table>
                <div v-if="healthCareCost.comments.length > 0" class="mb-3 p-2 pb-0 bg-light-subtle">
                  <small>
                    <p v-for="comment of healthCareCost.comments" :key="comment._id">
                      <span class="fw-bold">{{ comment.author.name.givenName + ': ' }}</span>
                      <span>{{ comment.text }}</span>
                    </p>
                  </small>
                </div>
                <div v-if="healthCareCost.state < State.BOOKABLE" class="mb-3">
                  <label for="comment" class="form-label">{{ t('labels.comment') }}</label>
                  <TextArea
                    id="comment"
                    v-model="healthCareCost.comment as string | undefined"
                    :disabled="isReadOnly && !(endpointPrefix === 'examine/' && healthCareCost.state === State.IN_REVIEW)"></TextArea>
                </div>
                <div v-if="endpointPrefix === 'examine/'" class="mb-3">
                  <label for="bookingRemark" class="form-label">{{ t('labels.bookingRemark') }}</label>
                  <TextArea
                    id="bookingRemark"
                    v-model="healthCareCost.bookingRemark"
                    :disabled="isReadOnly && !(endpointPrefix === 'examine/' && healthCareCost.state === State.IN_REVIEW)"></TextArea>
                </div>
                <div v-if="healthCareCost.state === State.EDITABLE_BY_OWNER">
                  <TooltipElement v-if="healthCareCost.expenses.length < 1" :text="t('alerts.noData.expense')">
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
                <template v-else-if="healthCareCost.state === State.IN_REVIEW">
                  <div v-if="endpointPrefix === 'examine/'" class="mb-2">
                    <a class="btn btn-primary" :href="mailToInsuranceLink" @click="completeReview()">
                      <i class="bi bi-pencil-square"></i>
                      <span class="ms-1">{{ t('labels.completeReview') }}</span>
                    </a>
                  </div>
                  <div>
                    <button
                      class="btn btn-secondary"
                      @click="
                        healthCareCost.editor._id !== healthCareCost.owner._id && endpointPrefix !== 'examine/' ? null : backToInWork()
                      "
                      :disabled="healthCareCost.editor._id !== healthCareCost.owner._id && endpointPrefix !== 'examine/'">
                      <i class="bi bi-arrow-counterclockwise"></i>
                      <span class="ms-1">{{ t(endpointPrefix === 'examine/' ? 'labels.backToApplicant' : 'labels.editAgain') }}</span>
                    </button>
                  </div>
                </template>
                <template v-else-if="healthCareCost.state >= State.BOOKABLE">
                  <div>
                    <button
                      class="btn btn-primary"
                      @click="
                        showFile({
                          endpoint: `${props.endpointPrefix}healthCareCost/report`,
                          params: { _id: healthCareCost._id },
                          filename: `${healthCareCost.name}.pdf`,
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
                  <div class="mt-2">
                    <a v-if="endpointPrefix === 'examine/'" class="btn btn-secondary" :href="mailToInsuranceLink">
                      <i class="bi bi-envelope"></i>
                      <span class="ms-1">{{ t('labels.mailToInsurance') }}</span>
                    </a>
                  </div>
                </template>
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
import { getTotalTotal, mailToLink } from '@/../../common/scripts.js'
import {
  DocumentFile,
  Expense,
  HealthCareCost,
  HealthCareCostSimple,
  HealthCareCostState,
  Organisation,
  State,
  UserSimple
} from '@/../../common/types.js'
import API from '@/api.js'
import APP_LOADER from '@/appData'
import AddUpTable from '@/components/elements/AddUpTable.vue'
import CurrencySelector from '@/components/elements/CurrencySelector.vue'
import FileUpload from '@/components/elements/FileUpload.vue'
import HelpButton from '@/components/elements/HelpButton.vue'
import ModalComponent from '@/components/elements/ModalComponent.vue'
import StatePipeline from '@/components/elements/StatePipeline.vue'
import TextArea from '@/components/elements/TextArea.vue'
import TooltipElement from '@/components/elements/TooltipElement.vue'
import ExpenseForm from '@/components/healthCareCost/forms/ExpenseForm.vue'
import HealthCareCostForm from '@/components/healthCareCost/forms/HealthCareCostForm.vue'
import { formatter } from '@/formatter.js'
import { showFile } from '@/helper.js'
import { logger } from '@/logger.js'

type ModalObject = Partial<Expense> | HealthCareCostSimple
type ModalObjectType = 'expense' | 'healthCareCost'
type ModalMode = 'add' | 'edit'

const props = defineProps({
  _id: { type: String, required: true },
  parentPages: { type: Array as PropType<{ link: string; title: string }[]>, required: true },
  endpointPrefix: { type: String, default: '' }
})

const router = useRouter()
const { t } = useI18n()

const healthCareCost = ref<HealthCareCost>({} as HealthCareCost)
const modalObject = ref<ModalObject>({})
const modalMode = ref<ModalMode>('add')
const modalObjectType = ref<ModalObjectType>('expense')
const isReadOnlySwitchOn = ref(true)
const modalFormIsLoading = ref(false)

const isDownloading = ref('')
const isDownloadingFn = () => isDownloading

const isReadOnly = computed(() => {
  return (
    (healthCareCost.value.state > State.EDITABLE_BY_OWNER ||
      (healthCareCost.value.state === State.EDITABLE_BY_OWNER && props.endpointPrefix === 'examine/')) &&
    isReadOnlySwitchOn.value
  )
})

const modalCompRef = useTemplateRef('modalComp')

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

async function deleteHealthCareCost() {
  const result = await API.deleter(`${props.endpointPrefix}healthCareCost`, { _id: props._id })
  if (result) {
    router.push({ path: props.parentPages[0].link })
  }
}

async function toExamination() {
  const result = await API.setter<HealthCareCost>(`${props.endpointPrefix}healthCareCost/underExamination`, {
    _id: healthCareCost.value._id,
    comment: healthCareCost.value.comment
  })
  if (result.ok) {
    router.push({ path: props.parentPages[0].link })
  }
}

async function backToInWork() {
  const result = await API.setter<HealthCareCost>(`${props.endpointPrefix}healthCareCost/inWork`, {
    _id: healthCareCost.value._id,
    comment: healthCareCost.value.comment
  })
  if (result.ok) {
    if (props.endpointPrefix === 'examine/') {
      router.push({ path: '/examine/healthCareCost' })
    } else {
      setHealthCareCost(result.ok)
    }
  }
}

async function completeReview() {
  const result = await API.setter<HealthCareCost>('examine/healthCareCost/reviewCompleted', {
    _id: healthCareCost.value._id,
    comment: healthCareCost.value.comment,
    bookingRemark: healthCareCost.value.bookingRemark
  })
  if (result.ok) {
    setHealthCareCost(result.ok)
  }
}

async function postExpense(expense: Expense) {
  let headers: Record<string, string> = {}
  if (expense.cost.receipts) {
    headers = { 'Content-Type': 'multipart/form-data' }
  }
  modalFormIsLoading.value = true
  const result = await API.setter<HealthCareCost>(`${props.endpointPrefix}healthCareCost/expense`, expense, {
    headers,
    params: { parentId: healthCareCost.value._id }
  })
  modalFormIsLoading.value = false
  if (result.ok) {
    setHealthCareCost(result.ok)
    resetAndHide()
  }
}

async function deleteExpense(_id: string) {
  modalFormIsLoading.value = true
  const result = await API.deleter(`${props.endpointPrefix}healthCareCost/expense`, { _id, parentId: props._id })
  modalFormIsLoading.value = false
  if (result) {
    setHealthCareCost(result as HealthCareCost)
    resetAndHide()
  }
}

async function editHealthCareCostDetails(updatedHealthCareCost: HealthCareCost) {
  modalFormIsLoading.value = true
  const result = await API.setter<HealthCareCost>(
    `${props.endpointPrefix}healthCareCost${props.endpointPrefix === 'examine/' ? '' : '/inWork'}`,
    updatedHealthCareCost
  )
  modalFormIsLoading.value = false
  if (result.ok) {
    setHealthCareCost(result.ok)
    resetAndHide()
  } else {
    await getHealthCareCost()
  }
}

async function getHealthCareCost() {
  const params = { _id: props._id, additionalFields: ['expenses'] }
  const result = (await API.getter<HealthCareCost>(`${props.endpointPrefix}healthCareCost`, params)).ok
  if (result) {
    setHealthCareCost(result.data)
  }
}

function setHealthCareCost(newHealthCareCost: HealthCareCost) {
  healthCareCost.value = newHealthCareCost
  logger.info(`${t('labels.healthCareCost')}:`)
  logger.info(healthCareCost.value)
}

async function getExaminerMails(): Promise<string[]> {
  const result = (await API.getter<UserSimple[]>('healthCareCost/examiner')).ok
  if (result) {
    return result.data.map((x) => x.email)
  }
  return []
}

function getNext(expense: Expense) {
  const idx = healthCareCost.value.expenses.findIndex((e) => e._id === expense._id)
  if (idx === -1 || idx + 1 === healthCareCost.value.expenses.length) {
    return undefined
  }
  return healthCareCost.value.expenses[idx + 1]
}

function getPrev(expense: Expense) {
  const idx = healthCareCost.value.expenses.findIndex((e) => e._id === expense._id)
  if (idx === -1 || idx === 0) {
    return undefined
  }
  return healthCareCost.value.expenses[idx - 1]
}

await APP_LOADER.loadData()

try {
  await getHealthCareCost()
} catch (e) {
  router.push({ path: props.parentPages[props.parentPages.length - 1].link })
}

let mailToInsuranceLink = ''
if (props.endpointPrefix === 'examine/') {
  const result = await API.getter<Organisation>('examine/healthCareCost/organisation', { _id: healthCareCost.value.project.organisation })
  if (result.ok) {
    const orga = result.ok.data
    const subject = t('mail.toInsurance.subject', { companyNumber: orga.companyNumber })
    const body = t('mail.toInsurance.body', {
      insuranceName: healthCareCost.value.insurance.name,
      owner: formatter.name(healthCareCost.value.owner.name),
      bankDetails: orga.bankDetails,
      organisationName: orga.name,
      amount: formatter.baseCurrency(getTotalTotal(healthCareCost.value.addUp)),
      projectIdentifier: healthCareCost.value.project.identifier
    })
    mailToInsuranceLink = mailToLink([healthCareCost.value.insurance.email], subject, body)
  }
}

const examinerMails = await getExaminerMails()
</script>

<style></style>
