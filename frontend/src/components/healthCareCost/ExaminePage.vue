<template>
  <div>
    <ModalComponent
      ref="modalComp"
      :header="
        modalMode === 'add' ? t('labels.newX', { X: t('labels.healthCareCost') }) : t('labels.editX', { X: t('labels.healthCareCost') })
      ">
      <div v-if="modalHealthCareCost">
        <HealthCareCostForm
          :mode="modalMode"
          :healthCareCost="modalHealthCareCost"
          :loading="modalFormIsLoading"
          endpointPrefix="examine/"
          @cancel="resetAndHide()"
          @add="addHealthCareCost" />
      </div>
    </ModalComponent>
    <div class="container py-3">
      <div class="row mb-3 justify-content-end gx-4 gy-2">
        <div class="col-auto me-auto">
          <h2>{{ t('accesses.examine/healthCareCost') }}</h2>
        </div>
        <div class="col-auto">
          <button class="btn btn-secondary" @click="showModal('add', undefined)">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">{{ t('labels.createX', { X: t('labels.healthCareCost') }) }}</span>
          </button>
        </div>
      </div>
      <HealthCareCostList
        class="mb-5"
        endpoint="examine/healthCareCost"
        :stateFilter="HealthCareCostState.IN_REVIEW"
        :columns-to-hide="['state', 'editor', 'updatedAt', 'report', 'organisation', 'bookingRemark']"
        dbKeyPrefix="examine" />
      <template v-if="!show">
        <button type="button" class="btn btn-light me-2" @click="show = HealthCareCostState.IN_WORK">
          {{ t('labels.show') }}
          <StateBadge :state="HealthCareCostState.IN_WORK" :StateEnum="HealthCareCostState" />
          <i class="bi bi-chevron-down"></i>
        </button>
        <button type="button" class="btn btn-light" @click="show = HealthCareCostState.REVIEW_COMPLETED">
          {{ t('labels.show') }}
          <StateBadge :state="HealthCareCostState.REVIEW_COMPLETED" :StateEnum="HealthCareCostState" />
          <i class="bi bi-chevron-down"></i>
        </button>
      </template>
      <template v-else>
        <button type="button" class="btn btn-light" @click="show = null">
          {{ t('labels.hide') }}
          <StateBadge :state="show" :StateEnum="HealthCareCostState" />
          <i class="bi bi-chevron-up"></i>
        </button>
        <hr class="hr" >
        <HealthCareCostList
          endpoint="examine/healthCareCost"
          :stateFilter="show === HealthCareCostState.IN_WORK ? show : { $gte: show }"
          :columns-to-hide="['report', 'organisation']"
          dbKeyPrefix="examined" />
      </template>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { HealthCareCostSimple, HealthCareCostState } from 'abrechnung-common/types.js'
import { ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import API from '@/api.js'
import ModalComponent from '@/components/elements/ModalComponent.vue'
import StateBadge from '@/components/elements/StateBadge.vue'
import HealthCareCostForm from '@/components/healthCareCost/forms/HealthCareCostForm.vue'
import HealthCareCostList from '@/components/healthCareCost/HealthCareCostList.vue'
import APP_LOADER from '@/dataLoader.js'

const { t } = useI18n()

type ModalMode = 'add' | 'edit'

const modalHealthCareCost = ref({} as Partial<HealthCareCostSimple<string>>)
const modalMode = ref('add' as ModalMode)
const show = ref(null as HealthCareCostState.IN_WORK | HealthCareCostState.REVIEW_COMPLETED | null)
const modalFormIsLoading = ref(false)

const modalCompRef = useTemplateRef('modalComp')

function showModal(mode: ModalMode, healthCareCost?: Partial<HealthCareCostSimple<string>>) {
  if (healthCareCost) {
    modalHealthCareCost.value = healthCareCost
  }
  modalMode.value = mode
  modalCompRef.value?.modal?.show()
}

function hideModal() {
  modalCompRef.value?.hideModal()
}

function resetModal() {
  modalMode.value = 'add'
  modalHealthCareCost.value = {}
}

function resetAndHide() {
  resetModal()
  hideModal()
}

async function addHealthCareCost(healthCareCost: Partial<HealthCareCostSimple>) {
  modalFormIsLoading.value = true
  const result = await API.setter<HealthCareCostSimple>('examine/healthCareCost/inWork', healthCareCost)
  modalFormIsLoading.value = false
  if (result.ok) {
    resetAndHide()
  }
}

await APP_LOADER.loadData()
</script>

<style></style>
