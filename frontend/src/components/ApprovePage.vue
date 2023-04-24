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
              v-if="modalTravel.state =='appliedFor'"
              ref="travelApproveForm"
              :travel="modalTravel"
              @cancel="hideModal()"
              @decision="approveTravel"
            ></TravelApproveForm>
            <TravelApply v-else :travel="modalTravel" :showButtons="false"></TravelApply>
          </div>
        </div>
      </div>
    </div>
    <div class="container">
      <h1 class="mb-3">{{ $t('labels.approve') }}</h1>
      <div class="row justify-content-center gx-4 gy-2">
        <div class="col-auto" v-for="travel of travels" :key="travel._id">
          <TravelCard :travel="travel" :showTraveler="true" @clicked="showModal(travel)"></TravelCard>
        </div>
      </div>
      <button v-if="!showApproved" type="button" class="btn btn-light" @click="showApproved = true">{{$t('labels.showApproved')}} <i class="bi bi-chevron-down"></i></button>
      <template v-else>
        <button type="button" class="btn btn-light" @click="showApproved = false">{{$t('labels.hideApproved')}} <i class="bi bi-chevron-up"></i></button>
        <hr class="hr">
        <div class="row justify-content-center gx-4 gy-2">
        <div class="col-auto" v-for="travel of approvedTravels" :key="travel._id">
          <TravelCard :travel="travel" :showTraveler="true" @clicked="showModal(travel)"></TravelCard>
        </div>
      </div>
      </template>
      
    </div>
  </div>
</template>

<script>
import { Modal } from 'bootstrap'
import TravelCard from './Elements/TravelCard.vue'
import TravelApproveForm from './Forms/TravelApproveForm.vue'
import TravelApply from './Elements/TravelApplication.vue'

export default {
  name: 'ApprovePage',
  components: { TravelCard, TravelApproveForm, TravelApply },
  props: [],
  data() {
    return {
      travels: [],
      approveTravelModal: undefined,
      modalTravel: undefined,
      showApproved: false,
      approvedTravels : []
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
    },
    async approveTravel(decision, comment) {
      this.modalTravel.comment = comment
      const result = await this.$root.setter('approve/travel/' + decision, this.modalTravel)
      if (result) {
        this.travels = await this.$root.getter('approve/travel')
        this.hideModal()
      }
    },
  },
  mounted() {
    this.approveTravelModal = new Modal(document.getElementById('approveTravelModal'), {})
  },
  async beforeMount() {
    await this.$root.load()
    this.travels = await this.$root.getter('approve/travel')
    this.approvedTravels = await this.$root.getter('approve/travel/approved')
  },
}
</script>

<style>
</style>