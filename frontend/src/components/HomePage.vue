<template>
  <div>
    <div class="modal fade" id="newTripModal" tabindex="-1" aria-labelledby="newTripModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5>New Trip!/</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <p>Hi</p>
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
          <button class="btn btn-secondary" @click="newTripModal.show()">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">{{ $t('labels.applyForX', { X: $t('labels.travel') }) }}</span>
          </button>
        </div>
      </div>
      <div class="row justify-content-center gx-4 gy-2">
        <div class="col-auto" v-for="travel in $root.travels" :key="travel._id">
          <TravelCard
            :travel="travel"
            @clicked="showModal('view', recipe)"
          ></TravelCard>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { Modal } from 'bootstrap'
import TravelCard from './Elements/TravelCard.vue'
export default {
  name: 'HomePage',
  components: {TravelCard, vSelect},
  props: [],
  data() {
    return {
      newTripModal: undefined,
    }
  },
  methods: {},
  mounted() {
    this.newTripModal = new Modal(document.getElementById('newTripModal'), {})
  },
  async beforeMount() {
    await this.$root.load()
  },
}
</script>

<style>
</style>