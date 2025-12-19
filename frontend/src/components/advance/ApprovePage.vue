<template>
  <div>
    <ModalComponent
      :header="modalAdvance.state ? modalAdvance.name : t('labels.newX', { X: t('labels.advance') })"
      ref="modalComp"
      @afterClose="modalMode === 'view' ? resetModal() : null">
      <template #header="{header}">
        <h5 class="modal-title">{{header}}</h5>
        <RefStringBadge v-if="modalAdvance.reference" class="ms-2" :number="modalAdvance.reference" type="Advance" />
      </template>
      <div v-if="modalAdvance">
        <template v-if="modalMode === 'view'">
          <template v-if="modalAdvance._id">
            <AdvanceApproveForm
              v-if="modalAdvance.state === AdvanceState.APPLIED_FOR"
              :advance="(modalAdvance as AdvanceSimple<string>)"
              :loading="modalFormIsLoading"
              @cancel="resetAndHide()"
              @decision="(d, c, br) => approveAdvance((modalAdvance as AdvanceSimple<string>), d, c, br)" />
            <template v-else>
              <Advance :advance="(modalAdvance as AdvanceSimple<string>)" endpointPrefix="approve/" />
              <template v-if="!modalAdvance.settledOn">
                <form class="mb-2 mt-3" v-if="showOffsetForm" @submit.prevent="offsetAdvance(modalAdvance._id, offsetAmount)">
                  <div class="row gy-3">
                    <label for="amount" class="col-form-label col-auto">
                      {{ t('labels.amount') }}
                      <span class="text-danger">*</span>
                    </label>
                    <div class="col-auto">
                      <input type="number" class="form-control" id="amount" step="0.01" v-model="offsetAmount" min="0" required >
                    </div>
                    <label for="subject" class="col-form-label col-auto">
                      {{ t('labels.subject') }}
                      <span class="text-danger">*</span>
                    </label>
                    <div class="col-auto">
                      <input type="text" class="form-control" id="subject" v-model="offsetSubject" required >
                    </div>
                    <div class="col-auto">
                      <div class="mb-1 d-flex align-items-center">
                        <button type="submit" class="btn btn-primary me-2" :disabled="modalFormIsLoading">{{ t('labels.offset') }}</button>
                        <span v-if="modalFormIsLoading" class="spinner-border spinner-border-sm ms-1 me-3"></span>
                        <button type="button" class="btn btn-light" @click="resetAndHide()">{{ t('labels.cancel') }}</button>
                      </div>
                    </div>
                  </div>
                </form>
                <div class="mb-2 d-flex" v-else>
                  <button type="button" class="btn btn-link pt-0 ms-auto" @click="showOffsetForm = true">
                    {{ t('labels.addX', {X: t('labels.offsetEntry')}) }}
                  </button>
                </div>
              </template>
            </template>
          </template>
        </template>
        <AdvanceForm
          v-else
          :mode="modalMode"
          @cancel="resetAndHide()"
          :advance="modalAdvance"
          askOwner
          askBookingRemark
          :loading="modalFormIsLoading"
          @add="(t) => approveAdvance(t as AdvanceSimple, 'approved')" />
      </div>
    </ModalComponent>
    <div class="container py-3">
      <div class="row mb-3 justify-content-end gx-4 gy-2">
        <div class="col-auto me-auto">
          <h2>{{ t('accesses.approve/advance') }}</h2>
        </div>
        <div class="col-auto">
          <button class="btn btn-secondary" @click="showModal('add', undefined)">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">{{ t('labels.createX', { X: t('labels.advance') }) }}</span>
          </button>
        </div>
      </div>
      <AdvanceList
        class="mb-5"
        ref="advanceList"
        endpoint="approve/advance"
        :stateFilter="AdvanceState.APPLIED_FOR"
        @clicked="(a) => router.push(`/approve/advance/${a._id}`)"
        :columns-to-hide="['balance', 'state', 'editor', 'report', 'organisation', 'bookingRemark', 'log.30.on', 'reference']"
        dbKeyPrefix="approve" />
      <button v-if="!show" type="button" class="btn btn-light" @click="show = AdvanceState.APPROVED">
        {{ t('labels.show') }}
        <StateBadge :state="AdvanceState.APPROVED" :StateEnum="AdvanceState" />
        <i class="bi bi-chevron-down"></i>
      </button>
      <template v-else>
        <button type="button" class="btn btn-light" @click="show = null">
          {{ t('labels.hide') }}
          <StateBadge :state="show" :StateEnum="AdvanceState" />
          <i class="bi bi-chevron-up"></i>
        </button>
        <hr class="hr" >
        <AdvanceList
          ref="approvedAdvanceList"
          endpoint="approve/advance"
          :stateFilter="{ $gte: AdvanceState.APPROVED }"
          :columns-to-hide="['updatedAt', 'report', 'organisation', 'reference']"
          @clicked="(a) => router.push(`/approve/advance/${a._id}`)"
          sort-by="log.30.on"
          sort-type="desc"
          dbKeyPrefix="approved" />
      </template>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { AdvanceSimple, AdvanceState } from 'abrechnung-common/types.js'
import { onMounted, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import API from '@/api.js'
import Advance from '@/components/advance/Advance.vue'
import AdvanceList from '@/components/advance/AdvanceList.vue'
import AdvanceApproveForm from '@/components/advance/forms/AdvanceApproveForm.vue'
import AdvanceForm from '@/components/advance/forms/AdvanceForm.vue'
import ModalComponent from '@/components/elements/ModalComponent.vue'
import RefStringBadge from '@/components/elements/RefStringBadge.vue'
import StateBadge from '@/components/elements/StateBadge.vue'

const props = defineProps<{ _id?: string }>()
const router = useRouter()
const { t } = useI18n()

const modalAdvance = ref<Partial<AdvanceSimple<string>>>({})
const modalMode = ref<'view' | 'add'>('view')
const show = ref<null | AdvanceState.APPROVED>(null)
const modalFormIsLoading = ref(false)
const showOffsetForm = ref(false)
const offsetAmount = ref(0)
const offsetSubject = ref('')

const modalComp = useTemplateRef('modalComp')
const advanceList = useTemplateRef('advanceList')
const approvedAdvanceList = useTemplateRef('approvedAdvanceList')

function showModal(mode: 'view' | 'add', advance?: Partial<AdvanceSimple<string>>) {
  if (advance) {
    modalAdvance.value = advance
  }
  modalMode.value = mode
  if (modalComp.value?.modal) {
    modalComp.value.modal.show()
  }
}

function hideModal() {
  modalComp.value?.hideModal()
}
function resetModal() {
  modalAdvance.value = {}
  modalMode.value = 'view'
  showOffsetForm.value = false
  offsetAmount.value = 0
  offsetSubject.value = ''
  router.push('/approve/advance')
}
function resetAndHide() {
  resetModal()
  hideModal()
}

async function approveAdvance(
  advance: AdvanceSimple,
  decision: 'approved' | 'rejected',
  comment?: string | null,
  bookingRemark?: string | null
) {
  if (advance) {
    if (comment) {
      advance.comment = comment
    }
    if (decision === 'approved' && bookingRemark) {
      advance.bookingRemark = bookingRemark
    }
    modalFormIsLoading.value = true
    const result = await API.setter<AdvanceSimple>(`approve/advance/${decision}`, advance)
    modalFormIsLoading.value = false
    if (result.ok) {
      advanceList.value?.loadFromServer()
      resetAndHide()
    }
  }
}
async function offsetAdvance(advanceId: string, amount: number) {
  if (advanceId && amount) {
    modalFormIsLoading.value = true
    const result = await API.setter<AdvanceSimple<string>>('approve/advance/offset', { advanceId, amount, subject: offsetSubject.value })
    modalFormIsLoading.value = false
    if (result.ok) {
      showModal('view', result.ok)
      approvedAdvanceList.value?.loadFromServer()
      offsetSubject.value = ''
    }
  }
}

async function showAdvance(_id: string) {
  const result = await API.getter<AdvanceSimple<string>>('approve/advance', { _id })
  if (result.ok) {
    showModal('view', result.ok.data)
  }
}

onMounted(() => {
  if (props._id) {
    showAdvance(props._id)
  }
})

watch(
  () => props._id,
  (value) => {
    if (value) {
      showAdvance(value)
    }
  }
)
</script>

<style></style>
