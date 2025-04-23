<template>
  <div>
    <ModalComponent
      ref="modalComp"
      :header="modalMode === 'add' ? $t('labels.newX', { X: $t('labels.' + modalObjectType) }) : modalObject ? modalObject.name : ''"
      @beforeClose="modalMode === 'edit' || modalMode === 'view' ? resetModal() : null">
      <div v-if="modalObject">
        <template v-if="modalObjectType === 'travel'">
          <TravelApplication
            v-if="modalMode === 'view'"
            :travel="(modalObject as TravelSimple)"
            :loading="modalFormIsLoading"
            @cancel="resetAndHide()"
            @edit="showModal('edit', 'travel', modalObject)"
            @deleted="deleteTravel">
          </TravelApplication>
          <TravelApplyForm
            v-else
            :mode="modalMode"
            @cancel="resetAndHide()"
            :travel="(modalObject as Partial<TravelSimple>)"
            :loading="modalFormIsLoading"
            @add="handleSubmit"
            @edit="handleSubmit"
            ref="travelApplyForm"></TravelApplyForm>
        </template>
        <ExpenseReportForm
          v-else-if="modalObjectType === 'expenseReport'"
          :mode="(modalMode as 'add' | 'edit')"
          :expenseReport="(modalObject as Partial<ExpenseReportSimple>)"
          :loading="modalFormIsLoading"
          @cancel="resetAndHide()"
          @add="handleSubmit">
        </ExpenseReportForm>
        <HealthCareCostForm
          v-else
          :mode="(modalMode as 'add' | 'edit')"
          :healthCareCost="(modalObject as Partial<HealthCareCostSimple>)"
          :loading="modalFormIsLoading"
          @cancel="resetAndHide()"
          @add="handleSubmit">
        </HealthCareCostForm>
      </div>
    </ModalComponent>
    <div v-if="APP_DATA" class="container py-3">
      <div class="row mb-3 justify-content-end gx-4 gy-2">
        <div class="col-auto me-auto">
          <h2>{{ $t('headlines.home') }}</h2>
        </div>
        <div v-if="!APP_DATA.settings.disableReportType.travel && APP_DATA.user.access['appliedFor:travel']" class="col-auto">
          <button class="btn btn-secondary" @click="showModal('add', 'travel', undefined)">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">{{
              $t(APP_DATA.user.access['approved:travel'] ? 'labels.addX' : 'labels.applyForX', { X: $t('labels.travel') })
            }}</span>
          </button>
        </div>
        <div v-if="!APP_DATA.settings.disableReportType.expenseReport && APP_DATA.user.access['inWork:expenseReport']" class="col-auto">
          <button class="btn btn-secondary" @click="showModal('add', 'expenseReport', undefined)">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">{{ $t('labels.addX', { X: $t('labels.expenseReport') }) }}</span>
          </button>
        </div>
        <div v-if="!APP_DATA.settings.disableReportType.healthCareCost && APP_DATA.user.access['inWork:healthCareCost']" class="col-auto">
          <button class="btn btn-secondary" @click="showModal('add', 'healthCareCost', undefined)">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">{{ $t('labels.submitX', { X: $t('labels.healthCareCost') }) }}</span>
          </button>
        </div>
      </div>
      <template v-if="!APP_DATA.settings.disableReportType.travel">
        <h3>{{ $t('labels.travel') }}</h3>
        <TravelList
          class="mb-4"
          ref="travelList"
          endpoint="travel"
          :columns-to-hide="['owner', 'updatedAt', 'report', 'addUp.total.amount', 'organisation', 'comments']"
          @clicked-applied="(t) => showModal('view', 'travel', t)"></TravelList>
      </template>
      <template v-if="!APP_DATA.settings.disableReportType.expenseReport">
        <h3>{{ $t('labels.expenses') }}</h3>
        <ExpenseReportList
          class="mb-4"
          ref="expenseReportList"
          endpoint="expenseReport"
          :columns-to-hide="['owner', 'updatedAt', 'report', 'addUp.total.amount', 'organisation', 'comments']"></ExpenseReportList>
      </template>
      <template v-if="!APP_DATA.settings.disableReportType.healthCareCost">
        <h3>{{ $t('labels.healthCareCost') }}</h3>
        <HealthCareCostList
          ref="healthCareCostList"
          endpoint="healthCareCost"
          :columns-to-hide="['owner', 'updatedAt', 'report', 'organisation', 'comments', 'log.underExamination.date']"></HealthCareCostList>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ExpenseReportSimple, HealthCareCostSimple, TravelSimple } from '@/../../common/types.js'
import API from '@/api.js'
import APP_LOADER from '@/appData.js'
import ModalComponent from '@/components/elements/ModalComponent.vue'
import ExpenseReportList from '@/components/expenseReport/ExpenseReportList.vue'
import ExpenseReportForm from '@/components/expenseReport/forms/ExpenseReportForm.vue'
import HealthCareCostList from '@/components/healthCareCost/HealthCareCostList.vue'
import HealthCareCostForm from '@/components/healthCareCost/forms/HealthCareCostForm.vue'
import TravelList from '@/components/travel/TravelList.vue'
import TravelApplication from '@/components/travel/elements/TravelApplication.vue'
import TravelApplyForm from '@/components/travel/forms/TravelApplyForm.vue'
import { ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'

type ModalMode = 'view' | 'add' | 'edit'
type ModalObjectType = 'travel' | 'expenseReport' | 'healthCareCost'
type ModalObject = Partial<TravelSimple> | Partial<ExpenseReportSimple> | Partial<HealthCareCostSimple>

const modalMode = ref<ModalMode>('add')
const modalObjectType = ref<ModalObjectType>('travel')
const modalObject = ref<ModalObject>({})
const modalFormIsLoading = ref(false)

const travelList = useTemplateRef('travelList')
const expenseReportList = useTemplateRef('expenseReportList')
const healthCareCostList = useTemplateRef('healthCareCostList')
const modalComp = useTemplateRef('modalComp')

const router = useRouter()

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

async function handleSubmit(payload: TravelSimple | ExpenseReportSimple | HealthCareCostSimple) {
  modalFormIsLoading.value = true
  let result: any

  if (modalObjectType.value === 'travel') {
    const path = APP_DATA.value?.user.access['approved:travel'] ? 'travel/approved' : 'travel/appliedFor'
    result = (await API.setter<TravelSimple>(path, payload as TravelSimple)).ok
  } else if (modalObjectType.value === 'expenseReport') {
    result = (await API.setter<ExpenseReportSimple>('expenseReport/inWork', payload as ExpenseReportSimple)).ok
  } else {
    result = (await API.setter<HealthCareCostSimple>('healthCareCost/inWork', payload as HealthCareCostSimple)).ok
  }

  modalFormIsLoading.value = false
  if (result) {
    if (modalObjectType.value === 'travel') {
      travelList.value?.loadFromServer()
    } else if (modalObjectType.value === 'expenseReport') {
      expenseReportList.value?.loadFromServer()
      router.push(`/expenseReport/${result._id}`)
    } else {
      healthCareCostList.value?.loadFromServer()
      router.push(`/healthCareCost/${result._id}`)
    }
    resetAndHide()
  }
}

async function deleteTravel(_id: string) {
  modalFormIsLoading.value = true
  const result = await API.deleter('travel', { _id })
  modalFormIsLoading.value = false
  if (result) {
    travelList.value?.loadFromServer()
    resetAndHide()
  }
}
</script>

<style></style>
