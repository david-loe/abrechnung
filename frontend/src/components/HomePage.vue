<template>
  <div>
    <div class="modal fade" id="newTravelModal" tabindex="-1" aria-labelledby="newTravelModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 v-if="modalMode === 'add'" class="modal-title" id="travelModalLabel">{{ $t('labels.newX', {X: $t('labels.travel') }) }}</h5>
            <h5 v-else class="modal-title" id="travelModalLabel">{{ modalTravel.name }}</h5>
            <button type="button" class="btn-close" @click="hideModal()"></button>
          </div>
          <div class="modal-body">
            <TravelApply v-if="modalMode === 'view'" :travel="modalTravel" @cancel="hideModal()" @edit="showModal('edit', modalTravel)"></TravelApply>
            <TravelApplyForm v-else :mode="modalMode" @cancel="hideModal()" :travel="modalTravel" @add="applyForTravel" @edit="applyForTravel" ref="travelApplyForm"></TravelApplyForm>
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
import TravelApply from './Elements/TravelApply.vue'
import TravelApplyForm from './Forms/TravelApplyForm.vue'
import axios from 'axios'

export default {
  name: 'HomePage',
  components: {TravelCard, TravelApplyForm, TravelApply},
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
    hideModal(){
      this.newTravelModal.hide()
      if(this.$refs.travelApplyForm){
        this.$refs.travelApplyForm.clear()
      }
    },
    async applyForTravel(travel){
      try {
        const res = await axios.post(process.env.VUE_APP_BACKEND_URL + '/api/travel/appliedFor', travel, {
          withCredentials: true,
        })
        if(res.status === 200){
          this.$root.travels = await this.$root.getter('travel')
          this.$root.addAlert({message: '', title: res.data.message, type: "success"})
          this.hideModal()
        }
      } catch (error) {
        if (error.response.status === 401) {
          this.$router.push('login')
        } else {
          console.log(error.response.data)
          this.$root.addAlert({message: error.response.data.message, title: "ERROR", type: "danger"})
        }
      }
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