<template>
  <div>
    <div class="modal fade" id="recordModal" tabindex="-1" aria-labelledby="recordModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg modal-fullscreen-sm-down">
        <div class="modal-content">
          <div class="modal-header">
            <h5 v-if="modalMode === 'add'" class="modal-title">{{ $t('labels.newX', { X: $t('labels.record') }) }}</h5>
            <h5 v-else class="modal-title">{{ $t('labels.editX', { X: $t('labels.record') }) }}</h5>
            <button type="button" class="btn-close" @click="hideModal"></button>
          </div>
          <div class="modal-body">
            <RecordForm v-if="travel" ref="recordForm" :mode="modalMode" :record="modalRecord"
              :askPurpose="Boolean(travel.professionalShare && travel.professionalShare < 0.8)"
              :askStayCost="!travel.claimOvernightLumpSum" @add="postRecord" @edit="postRecord" @deleted="deleteRecord"
              @cancel="hideModal" @deleteReceipt="deleteReceipt" @showReceipt="showReceipt">
            </RecordForm>
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

      <form class="mb-3" @submit.prevent ref="travelSettingsForm">
        <div class="row align-items-end justify-content-center gx-4 gy-2">
          <div class="col-auto">
            <div class="row align-items-center">
              <div class="col-auto pe-1">
                <InfoPoint :text="$t('info.professionalShare')" />
              </div>
              <div class="col-auto ps-0">
                <input type="number" class="form-control form-control-sm" v-model="travel.professionalShare" min="0.5"
                  max="0.8" step="any" :placeholder="$t('labels.professionalShare')" @change="postTravelSettings" />
              </div>
            </div>
          </div>
          <div class="col-auto">
            <div class="form-check form-switch">
              <input class="form-check-input" type="checkbox" role="switch" id="travelClaimOvernightLumpSum"
                v-model="travel.claimOvernightLumpSum" @change="postTravelSettings">
              <label class="form-check-label" for="travelClaimOvernightLumpSum">{{ $t('labels.claimOvernightLumpSum')
              }}</label>
              <InfoPoint class="ms-1" :text="$t('info.claimOvernightLumpSum')" />
            </div>

          </div>
        </div>
      </form>


      <button class="btn btn-secondary mb-3" @click="showModal('add', undefined)">
        <i class="bi bi-plus-lg"></i>
        <span class="ms-1">{{ $t('labels.addX', { X: $t('labels.record') }) }}</span>
      </button>

      <div v-if="travel.records.length == 0" class="alert alert-light" role="alert">
        {{ $t('alerts.noRecordsPresent') }}
      </div>

      <div v-for="(row, index) in table" :key="index">
        <div v-if="row.recordIndex" class="row ps-4 mb-1" style="cursor: pointer;"
          @click="showModal('edit', travel.records[row.recordIndex - 1])">
          <template v-if="travel.records[row.recordIndex - 1].type == 'stay'">
            <div class="col-auto">{{ travel.records[row.recordIndex - 1].location }}</div>
          </template>
          <template v-else>
            <div class="col-auto">{{ travel.records[row.recordIndex - 1].startLocation }} - {{
              travel.records[row.recordIndex - 1].endLocation }}</div>
          </template>
          <div class="col">{{ $t('labels.' + travel.records[row.recordIndex - 1].type) }}</div>
        </div>
        <div v-else class="row mb-1">
          <div class="col-auto">{{ row.date }}</div>
          <div class="col-auto text-secondary">{{ row.time }}</div>
        </div>
        <div v-if="row.gap" class="row ps-5">
          <div class="col-auto">
            <button class="btn btn-sm btn-light"
              @click="showModal('add', { startDate: row.startDate, endDate: row.endDate })" style="border-radius: 50%;">
              <i class="bi bi-plus-lg"></i>
            </button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script>
import { Modal } from 'bootstrap'
import StatePipeline from './Elements/StatePipeline.vue'
import RecordForm from './Forms/RecordForm.vue'
import InfoPoint from './Elements/InfoPoint.vue'
export default {
  name: 'TravelPage',
  data() {
    return {
      travel: undefined,
      recordModal: undefined,
      modalRecord: undefined,
      modalMode: 'add',
      dateFormat: { day: '2-digit', month: '2-digit' },
      timeFormat: { hour: '2-digit', minute: '2-digit' },
      table: []
    }
  },
  components: { StatePipeline, RecordForm, InfoPoint },
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
      this.modalRecord = undefined
    },
    async postTravelSettings() {
      if (this.$refs.travelSettingsForm.reportValidity()) {
        const travel = {
          _id: this.travel._id,
          claimOvernightLumpSum: this.travel.claimOvernightLumpSum,
          professionalShare: this.travel.professionalShare
        }
        const result = await this.$root.setter('travel', travel)
        if (!result) {
          await this.getTravel()
        }
      }
    },
    async deleteTravel() {
      const result = await this.$root.deleter('travel', { id: this._id })
      if (result) {
        this.$router.push({ path: '/' })
      }
    },
    async postRecord(record) {
      var headers = {}
      if (record.cost.receipts) {
        headers = {
          'Content-Type': 'multipart/form-data'
        }
      }
      record.travelId = this.travel._id
      const result = await this.$root.setter('travel/record', record, {headers})
      if (result) {
        await this.getTravel()
        this.hideModal()
      }
    },
    async deleteRecord(id) {
      const result = await this.$root.deleter('travel/record', { id: id, travelId: this._id })
      if (result) {
        await this.getTravel()
        this.hideModal()
      }
    },
    async deleteReceipt(id, recordId) {
      const result = await this.$root.deleter('travel/record/receipt', { id: id, recordId: recordId, travelId: this._id })
      if (result) {
        await this.getTravel()
      }
    },
    async showReceipt(id, recordId){
      const result = await this.$root.getter('travel/record/receipt', { id: id, recordId: recordId, travelId: this._id }, { responseType: 'blob' })
      if(result){
        const fileURL = URL.createObjectURL(result);
        window.open(fileURL)
      }
    },
    sameDay(a, b) {
      const dateA = new Date(a)
      const dateB = new Date(b)
      return dateA.getDate() === dateB.getDate() && dateA.getMonth() === dateB.getMonth()
    },
    sameHour(a, b) {
      const dateA = new Date(a)
      const dateB = new Date(b)
      return this.sameDay(a, b) && dateA.getHours() === dateB.getHours()
    },
    renderTable() {
      this.table = []
      var previousStartDate = null
      var previousEndDate = null
      var index = 0
      for (var i = 0; i < this.travel.records.length; i++) {
        var startDate = new Date(this.travel.records[i].startDate)
        var startTime = startDate.toLocaleTimeString(undefined, this.timeFormat)
        var startDateStr = startDate.toLocaleDateString(undefined, this.dateFormat)
        var endDate = new Date(this.travel.records[i].endDate)
        var endTime = endDate.toLocaleTimeString(undefined, this.timeFormat)
        var endDateStr = endDate.toLocaleDateString(undefined, this.dateFormat)
        if (previousStartDate && this.sameDay(previousEndDate, startDate)) {
          if (this.sameHour(previousEndDate, startDate)) {
            this.table.splice(--index, 1)

          } else {
            startDateStr = false
          }
        }
        this.table.push({ date: startDateStr, time: startTime })
        this.table.push({ recordIndex: i + 1 })
        var isNotLast = i !== this.travel.records.length - 1
        this.table.push({ date: endDateStr, time: endTime, gap: true, startDate: endDate, endDate: isNotLast ? this.travel.records[i + 1].startDate : null })
        index += 3
        previousStartDate = startDate
        previousEndDate = endDate
      }
    },
    async getTravel() {
      this.travel = await this.$root.getter('travel', { id: this._id, records: true })
      this.renderTable()
    }
  },
  async beforeMount() {
    await this.$root.load()
    await this.getTravel()
  },
  mounted() {
    this.recordModal = new Modal(document.getElementById('recordModal'), {})
  },
  watch: {
    // travel: function () {
    //   this.renderTable()
    // },
  },
}
</script>

<style></style>