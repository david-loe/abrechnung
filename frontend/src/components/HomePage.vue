<template>
  <div>
    <ModalComponent
      ref="modalComp"
      :header="modalMode === 'add' ? t('labels.newX', { X: t('labels.' + modalObjectType) }) : modalObject ? modalObject.name : ''"
      @afterClose="modalMode === 'edit' || modalMode === 'view' ? resetModal() : null">
      <div v-if="modalObject">
        <template v-if="modalMode === 'view'">
          <TravelApplication v-if="modalObjectType === 'travel'" :travel="(modalObject as TravelSimple)"></TravelApplication>
          <Advance v-else-if="modalObjectType === 'advance'" :advance="(modalObject as AdvanceSimple)"></Advance>
          <div v-if="modalObject.state !== undefined" class="mb-1">
            <template v-if="modalObject.state <= State.APPLIED_FOR">
              <button type="submit" class="btn btn-primary me-2" @click="showModal('edit', modalObjectType, modalObject)">
                {{ t('labels.edit') }}
              </button>
            </template>
            <template
              v-if="
                modalObject.state <= State.APPLIED_FOR ||
                (modalObject.state === State.BOOKED &&
                  (modalObjectType === 'travel' || (modalObjectType === 'advance' && Boolean((modalObject as AdvanceSimple).settledOn))))
              ">
              <button
                type="button"
                class="btn btn-danger me-2"
                @click="deleteReport(modalObjectType as 'travel' | 'advance', modalObject._id as string)">
                {{ t('labels.delete') }}
              </button>
              <button type="button" class="btn btn-light" @click="resetAndHide()">
                {{ t('labels.cancel') }}
              </button>
            </template>
          </div>
        </template>
        <template v-else>
          <TravelApplyForm
            v-if="modalObjectType === 'travel'"
            :mode="modalMode"
            :travel="(modalObject as Partial<TravelSimple>)"
            :loading="modalFormIsLoading"
            :owner="APP_DATA?.user"
            update-user-org
            @cancel="resetAndHide()"
            @add="handleSubmit"
            @edit="handleSubmit"
            ref="travelApplyForm"></TravelApplyForm>
          <ExpenseReportForm
            v-else-if="modalObjectType === 'expenseReport'"
            :mode="(modalMode as 'add' | 'edit')"
            :expenseReport="(modalObject as Partial<ExpenseReportSimple>)"
            :loading="modalFormIsLoading"
            :owner="APP_DATA?.user"
            update-user-org
            @cancel="resetAndHide()"
            @add="handleSubmit">
          </ExpenseReportForm>
          <HealthCareCostForm
            v-else-if="modalObjectType === 'healthCareCost'"
            :mode="(modalMode as 'add' | 'edit')"
            :healthCareCost="(modalObject as Partial<HealthCareCostSimple>)"
            :loading="modalFormIsLoading"
            :owner="APP_DATA?.user"
            update-user-org
            @cancel="resetAndHide()"
            @add="handleSubmit">
          </HealthCareCostForm>
          <AdvanceForm
            v-else
            :mode="(modalMode as 'add' | 'edit')"
            :advance="(modalObject as Partial<AdvanceSimple>)"
            :loading="modalFormIsLoading"
            @cancel="resetAndHide()"
            @add="handleSubmit"
            @edit="handleSubmit">
          </AdvanceForm>
        </template>
      </div>
    </ModalComponent>
    <div v-if="APP_DATA" class="container py-3">
      <div class="row mb-3 justify-content-end gx-4 gy-2">
        <div class="col-auto me-auto">
          <h2>{{ t('headlines.home') }}</h2>
        </div>
        <div v-if="!APP_DATA.settings.disableReportType.travel && APP_DATA.user.access['appliedFor:travel']" class="col-auto">
          <button class="btn btn-secondary" @click="showModal('add', 'travel', undefined)">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">
              {{ t(APP_DATA.user.access['approved:travel'] ? 'labels.addX' : 'labels.applyForX', { X: t('labels.travel') }) }}
            </span>
          </button>
        </div>
        <div v-if="!APP_DATA.settings.disableReportType.expenseReport && APP_DATA.user.access['inWork:expenseReport']" class="col-auto">
          <button class="btn btn-secondary" @click="showModal('add', 'expenseReport', undefined)">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">{{ t('labels.addX', { X: t('labels.expenseReport') }) }}</span>
          </button>
        </div>
        <div v-if="!APP_DATA.settings.disableReportType.healthCareCost && APP_DATA.user.access['inWork:healthCareCost']" class="col-auto">
          <button class="btn btn-secondary" @click="showModal('add', 'healthCareCost', undefined)">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">{{ t('labels.submitX', { X: t('labels.healthCareCost') }) }}</span>
          </button>
        </div>
        <div v-if="!APP_DATA.settings.disableReportType.advance && APP_DATA.user.access['appliedFor:advance']" class="col-auto">
          <button class="btn btn-secondary" @click="showModal('add', 'advance', undefined)">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">{{ t('labels.applyForX', { X: t('labels.advance') }) }}</span>
          </button>
        </div>
      </div>
      <template v-if="!APP_DATA.settings.disableReportType.travel">
        <h3>{{ t('labels.travel') }}</h3>
        <TravelList
          class="mb-4"
          ref="travelList"
          endpoint="travel"
          :columns-to-hide="COMMON_HIDDEN_COLUMNS"
          @clicked-applied="(t) => showModal('view', 'travel', t)"
          dbKeyPrefix="home"></TravelList>
      </template>
      <template v-if="!APP_DATA.settings.disableReportType.expenseReport">
        <h3>{{ t('labels.expenses') }}</h3>
        <ExpenseReportList
          class="mb-4"
          ref="expenseReportList"
          endpoint="expenseReport"
          :columns-to-hide="COMMON_HIDDEN_COLUMNS"
          dbKeyPrefix="home"></ExpenseReportList>
      </template>
      <template v-if="!APP_DATA.settings.disableReportType.healthCareCost">
        <h3>{{ t('labels.healthCareCost') }}</h3>
        <HealthCareCostList
          ref="healthCareCostList"
          endpoint="healthCareCost"
          :columns-to-hide="COMMON_HIDDEN_COLUMNS"
          dbKeyPrefix="home"></HealthCareCostList>
      </template>
      <template v-if="!APP_DATA.settings.disableReportType.advance">
        <h3>{{ t('labels.advance') }}</h3>
        <AdvanceList
          ref="advanceList"
          endpoint="advance"
          :columns-to-hide="['owner', 'updatedAt', 'report', 'organisation', 'bookingRemark', 'log.30.on']"
          @clicked="(t) => showModal('view', 'advance', t)"
          dbKeyPrefix="home"></AdvanceList>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { type AdvanceSimple, type ExpenseReportSimple, type HealthCareCostSimple, State, type TravelSimple } from '@/../../common/types.js'
import API from '@/api.js'
import APP_LOADER from '@/appData.js'
import Advance from '@/components/advance/Advance.vue'
import AdvanceList from '@/components/advance/AdvanceList.vue'
import AdvanceForm from '@/components/advance/forms/AdvanceForm.vue'
import ModalComponent from '@/components/elements/ModalComponent.vue'
import ExpenseReportList from '@/components/expenseReport/ExpenseReportList.vue'
import ExpenseReportForm from '@/components/expenseReport/forms/ExpenseReportForm.vue'
import HealthCareCostForm from '@/components/healthCareCost/forms/HealthCareCostForm.vue'
import HealthCareCostList from '@/components/healthCareCost/HealthCareCostList.vue'
import TravelApplication from '@/components/travel/elements/TravelApplication.vue'
import TravelApplyForm from '@/components/travel/forms/TravelApplyForm.vue'
import TravelList from '@/components/travel/TravelList.vue'

type ModalMode = 'view' | 'add' | 'edit'
type ModalObjectType = 'travel' | 'expenseReport' | 'healthCareCost' | 'advance'
type ModalObject = Partial<TravelSimple> | Partial<ExpenseReportSimple> | Partial<HealthCareCostSimple> | Partial<AdvanceSimple>

const modalMode = ref<ModalMode>('add')
const modalObjectType = ref<ModalObjectType>('travel')
const modalObject = ref<ModalObject>({})
const modalFormIsLoading = ref(false)

const travelList = useTemplateRef('travelList')
const expenseReportList = useTemplateRef('expenseReportList')
const healthCareCostList = useTemplateRef('healthCareCostList')
const advanceList = useTemplateRef('advanceList')
const modalComp = useTemplateRef('modalComp')

const COMMON_HIDDEN_COLUMNS = ['owner', 'updatedAt', 'report', 'addUp.totalTotal', 'organisation', 'bookingRemark']

const router = useRouter()
const { t } = useI18n()

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
  modalComp.value?.modal?.show()
}

function hideModal() {
  modalComp.value?.hideModal()
}

function resetModal() {
  modalObject.value = {}
  modalMode.value = 'add'
}

function resetAndHide() {
  resetModal()
  hideModal()
}

async function handleSubmit(payload: TravelSimple | ExpenseReportSimple | HealthCareCostSimple | Partial<AdvanceSimple>) {
  modalFormIsLoading.value = true
  let result: { _id: string } | undefined

  if (modalObjectType.value === 'travel') {
    const path = APP_DATA.value?.user.access['approved:travel'] ? 'travel/approved' : 'travel/appliedFor'
    result = (await API.setter<TravelSimple>(path, payload)).ok
  } else if (modalObjectType.value === 'expenseReport') {
    result = (await API.setter<ExpenseReportSimple>('expenseReport/inWork', payload)).ok
  } else if (modalObjectType.value === 'healthCareCost') {
    result = (await API.setter<HealthCareCostSimple>('healthCareCost/inWork', payload)).ok
  } else {
    result = (await API.setter<AdvanceSimple>('advance/appliedFor', payload)).ok
  }

  modalFormIsLoading.value = false
  if (result) {
    if (modalObjectType.value === 'travel') {
      travelList.value?.loadFromServer()
    } else if (modalObjectType.value === 'expenseReport') {
      expenseReportList.value?.loadFromServer()
      router.push(`/expenseReport/${result._id}`)
    } else if (modalObjectType.value === 'healthCareCost') {
      healthCareCostList.value?.loadFromServer()
      router.push(`/healthCareCost/${result._id}`)
    } else {
      advanceList.value?.loadFromServer()
    }
    resetAndHide()
  }
}

async function deleteReport(endpoint: 'travel' | 'advance', _id: string) {
  modalFormIsLoading.value = true
  const result = await API.deleter(endpoint, { _id })
  modalFormIsLoading.value = false
  if (result) {
    if (endpoint === 'travel') {
      travelList.value?.loadFromServer()
    } else {
      advanceList.value?.loadFromServer()
    }
    resetAndHide()
  }
}
</script>

<style></style>
