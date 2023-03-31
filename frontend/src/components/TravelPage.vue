<template>
  <div>
    <div class="modal fade" id="recordModal" tabindex="-1" aria-labelledby="recordModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg modal-fullscreen-sm-down">
        <div class="modal-content">
          <div class="modal-header">
            <h5 v-if="modalMode === 'add'" class="modal-title">{{ $t('labels.newX', { X: $t('labels.record') }) }}</h5>
            <h5 v-else class="modal-title">{{ $t('labels.editX', { X: $t('labels.record') }) }}</h5>
            <button type="button" class="btn-close" @click="hideModal()"></button>
          </div>
          <div class="modal-body">
            <RecordForm :mode="modalMode" :record="modalRecord" @add="postRecord" @edit="postRecord"></RecordForm>
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
      <StatePipeline class="mb-3" :state="travel.state"></StatePipeline>

    <button class="btn btn-secondary" @click="showModal('add', undefined)">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">{{ $t('labels.addX', { X: $t('labels.record') }) }}</span>
          </button>
    <div v-if="travel.records.length == 0" class="alert alert-light" role="alert">
      {{$t('alerts.noRecordsPresent')}}
    </div>
    <table class="table">
      <tbody>
        <tr v-for="record in travel.records" :key="record._id">
            <th>{{ record.startDate }}</th>
            <td>{{ $t('labels.' + record.type) }}</td>
        </tr>
      </tbody>
    </table>
    </div>
  </div>
</template>

<script>
import { Modal } from 'bootstrap'
import StatePipeline from './Elements/StatePipeline.vue'
import RecordForm from './Forms/RecordForm.vue'
export default {
  name: 'TravelPage',
  data() {
    return {
      travel: undefined,
      recordModal: undefined,
      modalRecord: undefined,
      modalMode: 'add'
    }
  },
  components: { StatePipeline, RecordForm },
  props: { _id: { type: String } },
  methods: {
    showModal(mode, record) {
      this.modalRecord = record
      this.modalMode = mode
      this.recordModal.show()
    },
    hideModal() {
      this.recordModal.hide()
      if (this.$refs.recordForm) {
        this.$refs.recordForm.clear()
      }
    },
    async deleteTravel() {
      const result = await this.$root.deleter('travel', this.travel._id)
      if (result) {
        this.$router.push({ path: '/' })
      }
    },
    async postRecord(record) {
      record.travelId = this.travel._id
      const result = await this.$root.setter('travel/record', record)
      if(result){
        this.travel = await this.$root.getter('travel', { id: this._id, records: true })
        this.hideModal()
      }
    }
  },
  async beforeMount() {
    await this.$root.load()
    this.travel = await this.$root.getter('travel', { id: this._id, records: true })
  },
  mounted() {
    this.recordModal = new Modal(document.getElementById('recordModal'), {})
  },
  watch: {
    // _id: async function () {
    //   if (this._id.match(/^[0-9a-fA-F]{24}$/)) {
    //     this.travel = await this.$root.getter('travel', { id: this._id, details: true })
    //   }
    // },
  },
}
</script>

<style>
</style>