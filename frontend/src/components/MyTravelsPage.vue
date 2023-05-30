<template>
  <div>
    <div class="modal fade" id="newTravelModal" tabindex="-1" aria-labelledby="newTravelModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg modal-fullscreen-sm-down">
        <div class="modal-content">
          <div class="modal-header">
            <h5 v-if="modalMode === 'add'" class="modal-title">{{ $t('labels.newX', { X: $t('labels.travel') }) }}</h5>
            <h5 v-else class="modal-title">{{ modalTravel.name }}</h5>
            <button type="button" class="btn-close" @click="hideModal()"></button>
          </div>
          <div class="modal-body">
            <TravelApply
              v-if="modalMode === 'view'"
              :travel="modalTravel"
              @cancel="hideModal()"
              @edit="showModal('edit', modalTravel)"
              @deleted="deleteTravel(modalTravel._id)"
            ></TravelApply>
            <TravelApplyForm
              v-else
              :mode="modalMode"
              @cancel="hideModal()"
              :travel="modalTravel"
              @add="applyForTravel"
              @edit="applyForTravel"
              ref="travelApplyForm"
            ></TravelApplyForm>
          </div>
        </div>
      </div>
    </div>
    <div class="container">
      <div class="row justify-content-between mb-3">
        <div class="col-auto">
          <h1>{{ $t('headlines.myTravels') }}</h1>
        </div>
        <div class="col-auto">
          <button class="btn btn-secondary" @click="showModal('add', undefined)">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">{{ $t('labels.applyForX', { X: $t('labels.travel') }) }}</span>
          </button>
        </div>
      </div>
      
          <TravelCardList endpoint="travel" @clicked="(t) => clickCard(t)"></TravelCardList>
       
    </div>
  </div>
</template>

<script>
import { Modal } from 'bootstrap'
import TravelCardList from './Elements/TravelCardList.vue'
import TravelApply from './Elements/TravelApplication.vue'
import TravelApplyForm from './Forms/TravelApplyForm.vue'

export default {
  name: 'MyTravelsPage',
  components: { TravelCardList, TravelApplyForm, TravelApply },
  props: [],
  data() {
    return {
      newTravelModal: undefined,
      modalMode: 'add',
      modalTravel: undefined,
    }
  },
  methods: {
    clickCard(travel) {
      if (['appliedFor', 'rejected'].indexOf(travel.state) > -1) {
        this.showModal('view', travel)
      } else {
        this.$router.push(`/travel/${travel._id}`)
      }
    },
    showModal(mode, travel) {
      this.modalMode = mode
      this.modalTravel = travel
      this.newTravelModal.show()
    },
    hideModal() {
      this.newTravelModal.hide()
      if (this.$refs.travelApplyForm) {
        this.$refs.travelApplyForm.clear()
      }
    },
    async applyForTravel(travel) {
      const result = await this.$root.setter('travel/appliedFor', travel)
      if (result) {
        //this.travels = (await this.$root.getter('travel')).data
        this.hideModal()
      }
    },
    async deleteTravel(id) {
      const result = await this.$root.deleter('travel', {id: id})
      if (result) {
        //this.travels = (await this.$root.getter('travel')).data
        this.hideModal()
      }
    },
  },
  mounted() {
    this.newTravelModal = new Modal(document.getElementById('newTravelModal'), {})
  },
  async beforeMount() {
    await this.$root.load()
  },
}
</script>

<style>
</style>