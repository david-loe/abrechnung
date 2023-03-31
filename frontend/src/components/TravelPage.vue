<template>
  <div>
    <div class="modal fade" id="recordModal" tabindex="-1" aria-labelledby="recordModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg modal-fullscreen-sm-down">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">TITELELEL</h5>
            <button type="button" class="btn-close" @click="hideModal()"></button>
          </div>
          <div class="modal-body">
          </div>
        </div>
      </div>
    </div>
    <div class="container" v-if="travel">
      <div class="row justify-content-between">
        <div class="col-10">
          <h1>{{ travel.name }}</h1>
        </div>
        <div class="col-auto">
          <div class="dropdown">
            <a class="nav-link link-dark" data-bs-toggle="dropdown" href="#" role="button">
              <i class="bi bi-three-dots-vertical fs-3"></i>
            </a>
            <ul class="dropdown-menu dropdown-menu-end">
              <li>
                <a class="dropdown-item" href="#" @click="deleteTravel">
                  <span class="me-1"><i class="bi bi-trash"></i></span>
                  <span>{{ $t('labels.delete') }}</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <StatePipeline :state="travel.state"></StatePipeline>
    </div>
  </div>
</template>

<script>
import { Modal } from 'bootstrap'
import StatePipeline from './Elements/StatePipeline.vue'
export default {
  name: 'TravelPage',
  data() {
    return {
      travel: undefined,
      recordModal: undefined
    }
  },
  components: { StatePipeline },
  props: { _id: { type: String } },
  methods: {
    showModal(travel) {
      this.modalTravel = travel
      this.recordModal.show()
    },
    hideModal() {
      this.recordModal.hide()
      if (this.$refs.travelApproveForm) {
        this.$refs.travelApproveForm.clear()
      }
    },
    async deleteTravel() {
      const result = await this.$root.deleter('travel', this.travel._id)
      if (result) {
        this.$router.push({ path: '/' })
      }
    },
  },
  async beforeMount() {
    await this.$root.load()
    this.travel = await this.$root.getter('travel', { id: this._id, records: true })
  },
  mounted() {
    this.recordModal = new Modal(document.getElementById('recordModal'), {})
  },
  watch: {
    _id: async function () {
      if (this._id.match(/^[0-9a-fA-F]{24}$/)) {
        this.travel = await this.$root.getter('travel', { id: this._id, details: true })
      }
    },
  },
}
</script>

<style>
</style>