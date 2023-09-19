<template>
  <div>
    <div class="modal fade" id="approveTravelModal" tabindex="-1" aria-labelledby="approveTravelModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg modal-fullscreen-sm-down">
        <div class="modal-content">
          <div class="modal-header">
            <h5 v-if="modalTravel" class="modal-title">{{ modalTravel.name }}</h5>
            <button type="button" class="btn-close" @click="hideModal()"></button>
          </div>
          <div v-if="modalTravel" class="modal-body">
            <TravelApproveForm
              v-if="modalTravel.state == 'appliedFor'"
              ref="travelApproveForm"
              :travel="modalTravel"
              @cancel="hideModal()"
              @decision="approveTravel"></TravelApproveForm>
            <TravelApply v-else :travel="modalTravel" :showButtons="false"></TravelApply>
          </div>
        </div>
      </div>
    </div>
    <div class="container">
      <h1 class="mb-3">{{ $t('labels.approve/travel') }}</h1>
      <TravelCardList
        class="mb-5"
        ref="travelCardListRef"
        endpoint="approve/travel"
        :showTraveler="true"
        @clicked="(t) => showModal(t)"></TravelCardList>
      <button v-if="!showApproved" type="button" class="btn btn-light" @click="showApproved = true">
        {{ $t('labels.showApprovedTravels') }} <i class="bi bi-chevron-down"></i>
      </button>
      <template v-else>
        <button type="button" class="btn btn-light" @click="showApproved = false">
          {{ $t('labels.hideApprovedTravels') }} <i class="bi bi-chevron-up"></i>
        </button>
        <hr class="hr" />
        <TravelCardList endpoint="approve/travel/approved" :showTraveler="true" @clicked="(t) => showModal(t)"> </TravelCardList>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { Modal } from 'bootstrap'
import TravelCardList from './elements/TravelCardList.vue'
import TravelApproveForm from './forms/TravelApproveForm.vue'
import TravelApply from './elements/TravelApplication.vue'
import { TravelSimple } from '../../../../common/types.js'

export default defineComponent({
  name: 'ApprovePage',
  components: { TravelCardList, TravelApproveForm, TravelApply },
  props: { _id: { type: String } },
  data() {
    return {
      approveTravelModal: undefined as Modal | undefined,
      modalTravel: undefined as TravelSimple | undefined,
      showApproved: false
    }
  },
  methods: {
    showModal(travel: TravelSimple) {
      this.modalTravel = travel
      if (this.approveTravelModal) {
        this.approveTravelModal.show()
      }
    },
    hideModal() {
      if (this.approveTravelModal) {
        this.approveTravelModal.hide()
      }
      if (this.$refs.travelApproveForm) {
        ;(this.$refs.travelApproveForm as typeof TravelApproveForm).clear()
      }

      this.modalTravel = undefined
    },
    async approveTravel(decision: 'approved' | 'rejected', comment?: string) {
      if (this.modalTravel) {
        this.modalTravel.comment = comment
        const result = await this.$root.setter('approve/travel/' + decision, this.modalTravel)
        if (result) {
          ;(this.$refs.travelCardListRef as typeof TravelCardList).getTravels()
          this.hideModal()
        }
      }
    }
  },
  async mounted() {
    const modalEl = document.getElementById('approveTravelModal')
    if (modalEl) {
      this.approveTravelModal = new Modal(modalEl, {})
    }
    if (this._id) {
      const result = await this.$root.getter('approve/travel', { id: this._id })
      if (result) {
        this.showModal(result.data)
      }
    }
  },
  async beforeMount() {
    await this.$root.load()
  }
})
</script>

<style></style>
