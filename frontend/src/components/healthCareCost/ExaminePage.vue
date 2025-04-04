<template>
  <div>
    <ModalComponent
      ref="modalComp"
      @close="resetForms()"
      :header="
        modalMode === 'add' ? $t('labels.newX', { X: $t('labels.healthCareCost') }) : $t('labels.editX', { X: $t('labels.healthCareCost') })
      ">
      <div v-if="modalHealthCareCost">
        <HealthCareCostForm
          ref="healthCareCostForm"
          :mode="modalMode"
          :healthCareCost="modalHealthCareCost"
          @cancel="hideModal()"
          @add="addHealthCareCost"
          askOwner>
        </HealthCareCostForm>
      </div>
    </ModalComponent>
    <div class="container">
      <div class="row mb-3 justify-content-end gx-4 gy-2">
        <div class="col-auto me-auto">
          <h1>{{ $t('accesses.examine/healthCareCost') }}</h1>
        </div>
        <div class="col-auto">
          <button class="btn btn-secondary" @click="showModal('add', {} as HealthCareCostSimple)">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">{{ $t('labels.createX', { X: $t('labels.healthCareCost') }) }}</span>
          </button>
        </div>
      </div>
      <HealthCareCostList
        class="mb-5"
        endpoint="examine/healthCareCost"
        stateFilter="underExamination"
        :columns-to-hide="['state', 'editor', 'updatedAt', 'report', 'organisation', 'log.underExamination.date']">
      </HealthCareCostList>
      <button v-if="!showRefunded" type="button" class="btn btn-light" @click="showRefunded = true">
        {{ $t('labels.showX', { X: $t('labels.underExaminationByInsuranceHealthCareCosts') }) }} <i class="bi bi-chevron-down"></i>
      </button>
      <template v-else>
        <button type="button" class="btn btn-light" @click="showRefunded = false">
          {{ $t('labels.hideX', { X: $t('labels.underExaminationByInsuranceHealthCareCosts') }) }} <i class="bi bi-chevron-up"></i>
        </button>
        <hr class="hr" />
        <HealthCareCostList
          endpoint="examine/healthCareCost"
          stateFilter="underExaminationByInsurance"
          :columns-to-hide="['state', 'report', 'organisation', 'log.underExamination.date']">
        </HealthCareCostList>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import API from '@/api.js'
import APP_LOADER from '@/appData.js'
import { defineComponent } from 'vue'
import { HealthCareCostSimple } from '../../../../common/types.js'
import ModalComponent from '../elements/ModalComponent.vue'
import HealthCareCostList from './HealthCareCostList.vue'
import HealthCareCostForm from './forms/HealthCareCostForm.vue'

type ModalMode = 'add' | 'edit'

export default defineComponent({
  name: 'ExaminePage',
  components: { HealthCareCostList, HealthCareCostForm, ModalComponent },
  props: [],
  data() {
    return {
      modalHealthCareCost: undefined as HealthCareCostSimple | undefined,
      modalMode: 'add' as ModalMode,
      showRefunded: false
    }
  },
  methods: {
    showModal(mode: ModalMode, healthCareCost: HealthCareCostSimple | undefined) {
      this.modalHealthCareCost = healthCareCost
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
    resetForms() {
      if (this.$refs.healthCareCostForm) {
        ;(this.$refs.healthCareCostForm as typeof HealthCareCostForm).clear()
      }
      this.modalHealthCareCost = undefined
    },
    async addHealthCareCost(healthCareCost: HealthCareCostSimple) {
      const result = await API.setter<HealthCareCostSimple>('examine/healthCareCost/inWork', healthCareCost)
      if (result.ok) {
        ;(this.$refs.modalComp as typeof ModalComponent).hideModal()
      } else {
        ;(this.$refs.healthCareCostForm as typeof HealthCareCostForm).loading = false
      }
    }
  },
  async created() {
    await APP_LOADER.loadData()
  }
})
</script>

<style></style>
