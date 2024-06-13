<template>
  <div>
    <ModalComponent
      @hideModal="hideModal()"
      :header="
        modalMode === 'add' ? $t('labels.newX', { X: $t('labels.healthCareCost') }) : $t('labels.editX', { X: $t('labels.healthCareCost') })
      "
      :showModalBody="modalHealthCareCost ? true : false">
      <HealthCareCostForm
        ref="healthCareCostForm"
        :mode="modalMode"
        :healthCareCost="modalHealthCareCost"
        @cancel="hideModal()"
        @add="addHealthCareCost"
        askOwner>
      </HealthCareCostForm>
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
      <HealthCareCostCardList
        class="mb-5"
        endpoint="examine/healthCareCost"
        :params="params('underExamination')"
        :showOwner="true"
        :showSearch="true"
        @clicked="(t) => $router.push('/examine/healthCareCost/' + t._id)">
      </HealthCareCostCardList>
      <button v-if="!showRefunded" type="button" class="btn btn-light" @click="showRefunded = true">
        {{ $t('labels.showX', { X: $t('labels.underExaminationByInsuranceHealthCareCosts') }) }} <i class="bi bi-chevron-down"></i>
      </button>
      <template v-else>
        <button type="button" class="btn btn-light" @click="showRefunded = false">
          {{ $t('labels.hideX', { X: $t('labels.underExaminationByInsuranceHealthCareCosts') }) }} <i class="bi bi-chevron-up"></i>
        </button>
        <hr class="hr" />
        <HealthCareCostCardList
          endpoint="examine/healthCareCost"
          :params="params('underExaminationByInsurance')"
          :showOwner="true"
          :showSearch="true"
          @clicked="(t) => $router.push('/examine/healthCareCost/' + t._id)">
        </HealthCareCostCardList>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import { Modal } from 'bootstrap'
import { defineComponent } from 'vue'
import { HealthCareCostSimple, HealthCareCostState } from '../../../../common/types.js'
import ModalComponent from '../elements/ModalComponent.vue'
import HealthCareCostCardList from './elements/HealthCareCostCardList.vue'
import HealthCareCostForm from './forms/HealthCareCostForm.vue'

type ModalMode = 'add' | 'edit'

export default defineComponent({
  name: 'ExaminePage',
  components: { HealthCareCostCardList, HealthCareCostForm, ModalComponent },
  props: [],
  data() {
    return {
      modal: undefined as Modal | undefined,
      modalHealthCareCost: undefined as HealthCareCostSimple | undefined,
      modalMode: 'add' as ModalMode,
      showRefunded: false
    }
  },
  methods: {
    params(state: HealthCareCostState) {
      return {
        filter: { $and: [{ state }] }
      }
    },
    showModal(mode: ModalMode, healthCareCost: HealthCareCostSimple | undefined) {
      this.modalHealthCareCost = healthCareCost
      this.modalMode = mode
      if (this.modal) {
        this.modal.show()
      }
    },
    hideModal() {
      if (this.modal) {
        this.modal.hide()
      }
      if (this.$refs.healthCareCostForm) {
        ;(this.$refs.healthCareCostForm as typeof HealthCareCostForm).clear()
      }
      this.modalHealthCareCost = undefined
    },
    async addHealthCareCost(healthCareCost: HealthCareCostSimple) {
      const result = await this.$root.setter<HealthCareCostSimple>('examine/healthCareCost/inWork', healthCareCost)
      if (result.ok) {
        this.hideModal()
      } else {
        ;(this.$refs.healthCareCostForm as typeof HealthCareCostForm).loading = false
      }
    }
  },
  async created() {
    await this.$root.load()
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
