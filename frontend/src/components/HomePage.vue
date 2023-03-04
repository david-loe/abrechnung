<template>
  <div>
    <div class="modal fade" id="newTravelModal" tabindex="-1" aria-labelledby="newTravelModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 v-if="modalMode === 'add'" class="modal-title" id="travelModalLabel">{{ $t('labels.newX', {X: $t('labels.travel') }) }}</h5>
            <h5 v-else-if="modalMode === 'edit'" class="modal-title" id="travelModalLabel">{{ modalTravel.name }}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <TravelApplyForm :mode="modalMode" @cancel="newTravelModal.hide()" :travel="modalTravel" @add="applyForTravel" @edit="applyForTravel"></TravelApplyForm>
          </div>
        </div>
      </div>
    </div>
    <div class="container">
      <div class="row justify-content-between mb-3">
        <div class="col-auto">
          <h1>{{ $t('labels.myTravels') }}</h1>
        </div>
        <div class="col-auto">
          <button class="btn btn-secondary" @click="newTravelModal.show()">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">{{ $t('labels.applyForX', { X: $t('labels.travel') }) }}</span>
          </button>
        </div>
      </div>
      <div class="row justify-content-center gx-4 gy-2">
        <div class="col-auto" v-for="travel in $root.travels" :key="travel._id">
          <TravelCard
            :travel="travel"
            @clicked="showModal('view', travel)"
          ></TravelCard>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { Modal } from 'bootstrap'
import TravelCard from './Elements/TravelCard.vue'
import TravelApplyForm from './Forms/TravelApplyForm.vue'
export default {
  name: 'HomePage',
  components: {TravelCard, TravelApplyForm},
  props: [],
  data() {
    return {
      newTravelModal: undefined,
      modalMode: 'add',
      modalTravel: undefined,
    }
  },
  methods: {
    showModal(mode, travel){
      this.modalMode = mode
      this.modalTravel = travel
      this.newTravelModal.show()
    },
    applyForTravel(){

    }
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