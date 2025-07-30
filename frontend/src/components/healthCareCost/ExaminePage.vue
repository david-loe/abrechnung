<template>
  <div>
    <ModalComponent
      ref="modalComp"
      :header="
        modalMode === 'add' ? $t('labels.newX', { X: $t('labels.healthCareCost') }) : $t('labels.editX', { X: $t('labels.healthCareCost') })
      ">
      <div v-if="modalHealthCareCost">
        <HealthCareCostForm
          :mode="modalMode"
          :healthCareCost="modalHealthCareCost"
          :loading="modalFormIsLoading"
          endpointPrefix="examine/"
          @cancel="resetAndHide()"
          @add="addHealthCareCost">
        </HealthCareCostForm>
      </div>
    </ModalComponent>
    <div class="container py-3">
      <div class="row mb-3 justify-content-end gx-4 gy-2">
        <div class="col-auto me-auto">
          <h2>{{ $t('accesses.examine/healthCareCost') }}</h2>
        </div>
        <div class="col-auto">
          <button class="btn btn-secondary" @click="showModal('add', undefined)">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">{{ $t('labels.createX', { X: $t('labels.healthCareCost') }) }}</span>
          </button>
        </div>
      </div>
      <HealthCareCostList
        class="mb-5"
        endpoint="examine/healthCareCost"
        :stateFilter="HealthCareCostState.IN_REVIEW"
        :columns-to-hide="['state', 'editor', 'updatedAt', 'report', 'organisation', 'bookingRemark']"
        dbKeyPrefix="examine">
      </HealthCareCostList>
      <template v-if="!show">
        <button type="button" class="btn btn-light me-2" @click="show = HealthCareCostState.IN_WORK">
          {{ $t('labels.show') }} <StateBadge :state="HealthCareCostState.IN_WORK" :StateEnum="HealthCareCostState"></StateBadge>
          <i class="bi bi-chevron-down"></i>
        </button>
        <button type="button" class="btn btn-light" @click="show = HealthCareCostState.REVIEW_COMPLETED">
          {{ $t('labels.show') }}
          <StateBadge :state="HealthCareCostState.REVIEW_COMPLETED" :StateEnum="HealthCareCostState"></StateBadge>
          <i class="bi bi-chevron-down"></i>
        </button>
      </template>
      <template v-else>
        <button type="button" class="btn btn-light" @click="show = null">
          {{ $t('labels.hide') }} <StateBadge :state="show" :StateEnum="HealthCareCostState"></StateBadge> <i class="bi bi-chevron-up"></i>
        </button>
        <hr class="hr" />
        <HealthCareCostList
          endpoint="examine/healthCareCost"
          :stateFilter="show === HealthCareCostState.IN_WORK ? show : { $gte: show }"
          :columns-to-hide="['report', 'organisation']"
          dbKeyPrefix="examined">
        </HealthCareCostList>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { HealthCareCostSimple, HealthCareCostState } from '@/../../common/types.js'
import API from '@/api.js'
import APP_LOADER from '@/appData.js'
import ModalComponent from '@/components/elements/ModalComponent.vue'
import StateBadge from '@/components/elements/StateBadge.vue'
import HealthCareCostForm from '@/components/healthCareCost/forms/HealthCareCostForm.vue'
import HealthCareCostList from '@/components/healthCareCost/HealthCareCostList.vue'

type ModalMode = 'add' | 'edit'

export default defineComponent({
  name: 'ExaminePage',
  components: { HealthCareCostList, HealthCareCostForm, ModalComponent, StateBadge },
  props: [],
  data() {
    return {
      modalHealthCareCost: {} as Partial<HealthCareCostSimple>,
      modalMode: 'add' as ModalMode,
      show: null as HealthCareCostState.IN_WORK | HealthCareCostState.REVIEW_COMPLETED | null,
      modalFormIsLoading: false,
      HealthCareCostState
    }
  },
  methods: {
    showModal(mode: ModalMode, healthCareCost?: Partial<HealthCareCostSimple>) {
      if (healthCareCost) {
        this.modalHealthCareCost = healthCareCost
      }
      this.modalMode = mode
      if ((this.$refs.modalComp as typeof ModalComponent).modal) {
        ;(this.$refs.modalComp as typeof ModalComponent).modal.show()
      }
    },
    hideModal() {
      if ((this.$refs.modalComp as typeof ModalComponent).modal) {
        ;(this.$refs.modalComp as typeof ModalComponent).hideModal()
      }
    },
    resetModal() {
      this.modalMode = 'add'
      this.modalHealthCareCost = {}
    },
    resetAndHide() {
      this.resetModal()
      this.hideModal()
    },
    async addHealthCareCost(healthCareCost: HealthCareCostSimple) {
      this.modalFormIsLoading = true
      const result = await API.setter<HealthCareCostSimple>('examine/healthCareCost/inWork', healthCareCost)
      this.modalFormIsLoading = false
      if (result.ok) {
        this.resetAndHide()
      }
    }
  },
  async created() {
    await APP_LOADER.loadData()
  }
})
</script>

<style></style>
