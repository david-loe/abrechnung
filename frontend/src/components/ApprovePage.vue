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
      <h1 class="mb-3">{{ $t('labels.approve') }}</h1>
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

<script>
import { Modal } from 'bootstrap'
import TravelCardList from './Elements/TravelCardList.vue'
import TravelApproveForm from './Forms/TravelApproveForm.vue'
import TravelApply from './Elements/TravelApplication.vue'

export default {
  name: 'ApprovePage',
  components: { TravelCardList, TravelApproveForm, TravelApply },
  props: { _id: { type: String } },
  data() {
    return {
      approveTravelModal: undefined,
      modalTravel: undefined,
      showApproved: false
    }
  },
  methods: {
    showModal(travel) {
      this.modalTravel = travel
      this.approveTravelModal.show()
    },
    hideModal() {
      this.approveTravelModal.hide()
      if (this.$refs.travelApproveForm) {
        this.$refs.travelApproveForm.clear()
      }
      this.modalTravel = undefined
    },
    async approveTravel(decision, comment) {
      this.modalTravel.comment = comment
      const result = await this.$root.setter('approve/travel/' + decision, this.modalTravel)
      if (result) {
        this.$refs.travelCardListRef.getTravels()
        this.hideModal()
      }
    }
  },
  async mounted() {
    this.approveTravelModal = new Modal(document.getElementById('approveTravelModal'), {})
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
}
</script>

<style></style>
