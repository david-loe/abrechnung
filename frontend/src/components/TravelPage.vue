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
              :askStayCost="!travel.claimOvernightLumpSum" @add="postRecord" @edit="postRecord" @deleted="deleteRecord"
              @cancel="hideModal" @deleteReceipt="deleteReceipt" @showReceipt="showReceipt">
            </RecordForm>
          </div>
        </div>
      </div>
    </div>
    <div class="container" v-if="travel">
      <h1>{{ travel.name }}</h1>

      <StatePipeline class="mb-3" :state="travel.state"></StatePipeline>

      <div class="row justify-content-center mb-3">
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

      <div class="row justify-content-end">
        <div class="col-auto">
          <button class="btn btn-secondary mb-3" @click="showModal('add', undefined)">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">{{ $t('labels.addX', { X: $t('labels.record') }) }}</span>
          </button>
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

      <div v-if="travel.records.length == 0" class="alert alert-light" role="alert">
        {{ $t('alerts.noRecordsPresent') }}
      </div>
      <div v-else class="row mb-2">
        <div class="col-auto">
          <button class="btn btn-link btn-sm" @click="travel.days.map(d => d.showSettings = true)">
            {{ $t('labels.expandAll') }}
            <i class="bi bi-arrows-expand"></i>
          </button>
        </div>
        <div class="col-auto">
          <button class="btn btn-link btn-sm" @click="travel.days.map(d => d.showSettings = false)">
            {{ $t('labels.collapseAll') }}
            <i class="bi bi-arrows-collapse"></i>
          </button>
        </div>
      </div>
      <div v-for="row of table" class="mb-2" :key="row.data._id">
        <!-- day -->
        <div v-if="row.type == 'day'" class="row align-items-center mt-3">
          <div class="col-auto">
            <h5 class="m-0">
              {{ $root.datetoDateString(row.data.date) }}
            </h5>
          </div>
          <div v-if="!row.data.showSettings" class="col">
            <div class="row align-items-center">
              <!-- refunds -->
              <template v-for="refund of row.data.refunds" :key="refund._id">
                <!-- catering -->
                <div v-if="refund.type.indexOf('catering') == 0" class="col-auto text-secondary" :title="$t('lumpSums.' + refund.type) + ' ' + getFlagEmoji(row.data.country)">
                  <i class="bi bi-sun"></i>
                  {{ $root.moneyString(refund.refund) }}
                </div>
                <!-- overnight -->
                <div v-else class="col-auto text-secondary" :title="$t('lumpSums.' + refund.type) + ' ' + getFlagEmoji(row.data.country)">
                  <i class="bi bi-moon"></i>
                  {{ $root.moneyString(refund.refund) }}
                </div>
              </template>
              <div class="col-auto ms-auto">
                <i class="bi bi-sliders" style="cursor: pointer;" @click="row.data.showSettings = true"></i>
              </div>
            </div>
          </div>
          <div v-else class="col">
            <div class="row align-items-center">
              <div class="col-auto pe-1">
                <InfoPoint :text="$t('info.cateringNoRefund')" />
              </div>
              <div v-for="key of ['breakfast', 'lunch', 'dinner']" class="form-check col-auto" :key="key">
                <input class="form-check-input" type="checkbox" role="switch"
                  :id="'configCateringRefund' + key + row.data._id" v-model="row.data.cateringNoRefund[key]"
                  @change="postTravelSettings" />
                <label class="form-check-label" :for="'configCateringRefund' + key + row.data._id">
                  {{ $t('labels.' + key) }}
                </label>
              </div>
              <div class="col-auto">
                <div class="row align-items-center">
                  <div class="col-auto pe-1">
                    <InfoPoint :text="$t('info.purpose')" />
                  </div>
                  <div class="col-auto ps-0">
                    <select class="form-select form-select-sm" v-model="row.data.purpose" @change="postTravelSettings"
                      required>
                      <option v-for="purpose of ['professional', 'private']" :value="purpose" :key="purpose">{{
                        $t('labels.'
                          +
                          purpose) }}</option>
                    </select>
                  </div>
                </div>
              </div>
              <div class="col-auto  ms-auto">
                <i class="bi bi-x-lg" style="cursor: pointer;" @click="row.data.showSettings = false"></i>
              </div>
            </div>
          </div>
        </div>
        <!-- Record -->
        <div v-else class="row align-items-center ps-4 mb-1" style="cursor: pointer;"
          @click="showModal('edit', row.data)">
          <div class="col-auto fs-3">
            <i :class="getRecordIcon(row.data)"></i>
          </div>
          <!-- Stay -->
          <div v-if="row.data.type == 'stay'" class="col-auto">
            {{ row.data.location.place }}
          </div>
          <!-- Route -->
          <div v-else class="col-auto">
            {{ displayLocation(row.data, 'start') }}
            <i class="bi bi-arrow-right"></i>
            {{ displayLocation(row.data, 'end') }}
          </div>
        </div>

        <!-- Date -->

        <div v-if="row.gap" class="row ps-5">
          <div class="col-auto">
            <button class="btn btn-sm btn-light" @click="showModal('add', row.gapRecord)" style="border-radius: 50%;">
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
import { getFlagEmoji } from '../scripts.js'
export default {
  name: 'TravelPage',
  data() {
    return {
      travel: undefined,
      recordModal: undefined,
      modalRecord: undefined,
      modalMode: 'add',
      table: [],
      configCateringRefund: false
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
      const travel = {
        _id: this.travel._id,
        claimOvernightLumpSum: this.travel.claimOvernightLumpSum,
        days: this.travel.days
      }
      const result = await this.$root.setter('travel', travel)
      if (result) {
        await this.getTravel()
      }else{
        await this.getTravel()
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
      const result = await this.$root.setter('travel/record', record, { headers })
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
    async showReceipt(id, recordId) {
      const result = await this.$root.getter('travel/record/receipt', { id: id, recordId: recordId, travelId: this._id }, { responseType: 'blob' })
      if (result) {
        const fileURL = URL.createObjectURL(result);
        window.open(fileURL)
      }
    },
    sameDay(a, b) {
      const dateA = new Date(a)
      const dateB = new Date(b)
      return dateA.getUTCDate() === dateB.getUTCDate() && dateA.getUTCMonth() === dateB.getUTCMonth()
    },
    sameHour(a, b) {
      const dateA = new Date(a)
      const dateB = new Date(b)
      return this.sameDay(a, b) && dateA.getUTCHours() === dateB.getUTCHours()
    },
    getFlagEmoji,
    displayLocation(record, location) {
      if (record.endLocation.country == record.startLocation.country) {
        return record[location + 'Location'].place
      } else {
        return record[location + 'Location'].place + ' ' + this.getFlagEmoji(record[location + 'Location'].country)
      }
    },
    getRecordIcon(record) {
      var icon = null
      if (record.type == 'stay') {
        icon = 'bi bi-house'
      } else {
        if (record.transport == 'ownCar') {
          icon = 'bi bi-car-front'
        } else if (record.transport == 'airplane') {
          icon = 'bi bi-airplane'
        } else if (record.transport == 'shipOrFerry') {
          icon = 'bi bi-water'
        } else if (record.transport == 'otherTransport') {
          icon = 'bi bi-train-front'
        }
      }
      return icon
    },
    renderTable() {
      this.table = []
      console.log('render')
      var recordIndex = 0;
      for (var i = 0; i < this.travel.days.length; i++) {
        var recordsStart = recordIndex
        while (recordIndex < this.travel.records.length && i < this.travel.days.length - 1 && new Date(this.travel.days[i + 1].date).valueOf() - new Date(this.travel.records[recordIndex].startDate).valueOf() > 0) {
          recordIndex++
        }
        var recordsEnd = recordIndex
        if (i == this.travel.days.length - 1) {
          recordsEnd = this.travel.records.length - 1
        }
        this.table.push({ type: 'day', data: this.travel.days[i] })
        for (const record of this.travel.records.slice(recordsStart, recordsEnd)) {
          this.table.push({ type: 'record', data: record })
        }
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