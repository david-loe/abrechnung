<template>
  <div>
    <div class="modal fade" id="modal" tabindex="-1" aria-labelledby="modalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg modal-fullscreen-sm-down">
        <div class="modal-content">
          <div class="modal-header">
            <h5 v-if="modalMode === 'add'" class="modal-title">{{ $t('labels.newX', { X: $t('labels.' + modalObjectType) }) }}</h5>
            <h5 v-else class="modal-title">{{ $t('labels.editX', { X: $t('labels.' + modalObjectType) }) }}</h5>
            <button type="button" class="btn-close" @click="hideModal"></button>
          </div>
          <div v-if="travel" class="modal-body">
            <StageForm v-if="modalObjectType === 'stage'" ref="stageForm" :mode="modalMode" :stage="modalObject"
              :travelStartDate="travel.startDate" :travelEndDate="travel.endDate" :disabled="isReadOnly" @add="postStage"
              @edit="postStage" @deleted="deleteStage" @cancel="hideModal" @deleteReceipt="deleteReceipt"
              @showReceipt="showReceipt">
            </StageForm>
            <ExpenceForm v-else-if="modalObjectType === 'expence'" ref="expenceForm" :expence="modalObject" :disabled="isReadOnly" :mode="modalMode" @add="postExpence"
              @edit="postExpence" @deleted="deleteExpence" @cancel="hideModal" @deleteReceipt="deleteReceipt"
              @showReceipt="showReceipt">
            </ExpenceForm>
          </div>
        </div>
      </div>
    </div>
    <div class="container" v-if="travel">
      <nav v-if="parentPages && parentPages.length > 0" aria-label="breadcrumb">
        <ol class="breadcrumb">
          <li class="breadcrumb-item" v-for="page of parentPages" :key="page.link"><router-link :to="page.link">{{
            $t(page.title) }}</router-link></li>
          <li class="breadcrumb-item active" aria-current="page">{{ travel.name }}</li>
        </ol>
      </nav>

      <div class="row justify-content-between">
        <div class="col">
          <h1>{{ travel.name }}</h1>
        </div>
        <div class="col-auto">
          <div class="dropdown">
            <a class="nav-link link-dark" data-bs-toggle="dropdown" data-bs-auto-close="outside" href="#" role="button">
              <i class="bi bi-three-dots-vertical fs-3"></i>
            </a>
            <ul class="dropdown-menu dropdown-menu-end">
              <template v-if="endpointMiddleware === 'examine/'">
                <li>
                  <div class="p-1 ps-3">
                    <div class="form-check form-switch form-check-reverse me-1">
                      <input class="form-check-input" type="checkbox" role="switch" id="editTravel" v-model="isReadOnly">
                      <label class="form-check-label text-nowrap" for="editTravel">
                        <span class="me-1"><i class="bi bi-lock"></i></span>
                        <span>{{ $t('labels.readOnly') }}</span>
                      </label>
                    </div>
                  </div>
                </li>
                <li>
                  <hr class="dropdown-divider" />
                </li>
              </template>

              <li>
                <a :class="'dropdown-item' + (isReadOnly ? ' disabled' : '')" href="#"
                  @click="isReadOnly ? null : deleteTravel()">
                  <span class="me-1"><i class="bi bi-trash"></i></span>
                  <span>{{ $t('labels.delete') }}</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <StatePipeline class="mb-3" :state="travel.state"></StatePipeline>

      <div class="row justify-content-center mb-5">
        <div class="col-auto">
          <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" role="switch" id="travelClaimOvernightLumpSum"
              v-model="travel.claimOvernightLumpSum" @change="postTravelSettings" :disabled="isReadOnly">
            <label class="form-check-label" for="travelClaimOvernightLumpSum">{{ $t('labels.claimOvernightLumpSum')
            }}</label>
            <InfoPoint class="ms-1" :text="$t('info.claimOvernightLumpSum')" />
          </div>
        </div>
        <!-- v-if="settings.allowSpouseRefund" -->
        <div class="col-auto">
          <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" role="switch" id="travelClaimSpouseRefund"
              v-model="travel.claimSpouseRefund" @change="postTravelSettings" :disabled="isReadOnly">
            <label class="form-check-label" for="travelClaimSpouseRefund">{{ $t('labels.claimSpouseRefund')
            }}</label>
            <InfoPoint class="ms-1" :text="$t('info.claimSpouseRefund')" />
          </div>
        </div>
      </div>

      <div class="row">
        <div class="col-lg-9 col-12">
          <div class="row mb-2">
            <div class="col-auto">
              <button class="btn btn-secondary" @click="isReadOnly ? null : showModal('add', undefined, 'stage')"
                :disabled="isReadOnly">
                <i class="bi bi-plus-lg"></i>
                <span class="ms-1">{{ $t('labels.addX', { X: $t('labels.stage') }) }}</span>
              </button>
            </div>
            <div class="col-auto">
              <button class="btn btn-secondary" @click="isReadOnly ? null : showModal('add', undefined, 'expence')"
                :disabled="isReadOnly">
                <i class="bi bi-plus-lg"></i>
                <span class="ms-1">{{ $t('labels.addX', { X: $t('labels.expence') }) }}</span>
              </button>
            </div>
          </div>
          <div class="row mb-2">
            <div class="col-auto">
              <button class="btn btn-link btn-sm" @click="travel.days.map(d => d.showSettings = true)"
                :disabled="travel.stages.length == 0">
                {{ $t('labels.expandAll') }}
                <i class="bi bi-arrows-expand"></i>
              </button>
            </div>
            <div class="col-auto">
              <button class="btn btn-link btn-sm" @click="travel.days.map(d => d.showSettings = false)"
                :disabled="travel.stages.length == 0">
                {{ $t('labels.collapseAll') }}
                <i class="bi bi-arrows-collapse"></i>
              </button>
            </div>
          </div>
          <div v-if="travel.stages.length == 0" class="alert alert-light" role="alert">
            {{ $t('alerts.noStagesPresent') }}
          </div>

          <div v-for="row of table" class="mb-2" :key="row.data._id">
            <!-- day -->
            <div v-if="row.type === 'day'" class="row align-items-center mt-3">
              <div class="col-auto">
                <h5 class="m-0">
                  {{ $root.datetoDateString(row.data.date) }}
                </h5>
              </div>
              <div class="col">
                <div class="row align-items-center">
                  <!-- refunds -->
                  <template v-if="!row.data.showSettings">
                    <template v-for="refund of row.data.refunds" :key="refund._id">
                      <!-- catering -->
                      <div v-if="refund.type.indexOf('catering') == 0" class="col-auto text-secondary"
                        :title="(travel.claimSpouseRefund ? '2x ' : '') + $t('lumpSums.' + refund.type) + ' ' + row.data.country.flag">
                        <i class="bi bi-sun"></i>
                        {{ getMoneyString(refund.refund) }}
                      </div>
                      <!-- overnight -->
                      <div v-else class="col-auto text-secondary"
                        :title="(travel.claimSpouseRefund ? '2x ' : '') + $t('lumpSums.' + refund.type) + ' ' + row.data.country.flag">
                        <i class="bi bi-moon"></i>
                        {{ getMoneyString(refund.refund) }}
                      </div>
                    </template>
                  </template>
                  <template v-else>
                    <div class="col-auto pe-1">
                      <InfoPoint :text="$t('info.cateringNoRefund')" />
                    </div>
                    <div v-for="key of ['breakfast', 'lunch', 'dinner']" class="form-check col-auto" :key="key">
                      <input class="form-check-input" type="checkbox" role="switch"
                        :id="'configCateringRefund' + key + row.data._id" v-model="row.data.cateringNoRefund[key]"
                        @change="isReadOnly ? null : postTravelSettings()" :disabled="isReadOnly" />
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
                          <select class="form-select form-select-sm" v-model="row.data.purpose"
                            @change="isReadOnly ? null : postTravelSettings()" :disabled="isReadOnly" required>
                            <option v-for="purpose of ['professional', 'private']" :value="purpose" :key="purpose">{{
                              $t('labels.'
                                +
                                purpose) }}</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </template>

                </div>
              </div>
              <div class="col-auto ms-auto">
                <i :class="row.data.showSettings ? 'bi bi-x-lg' : 'bi bi-sliders'" style="cursor: pointer;"
                  @click="row.data.showSettings = !row.data.showSettings"></i>
              </div>

            </div>
            <!-- Stage -->
            <div v-else-if="row.type === 'stage'" class="row align-items-center ps-4 mb-1" style="cursor: pointer;"
              @click="showModal('edit', row.data, 'stage')">
              <div class="col-auto fs-3">
                <i :class="getStageIcon(row.data)"></i>
              </div>
              <div class="col">
                <PlaceElement :place="row.data.startLocation"
                  :showCountry="row.data.startLocation.country._id != row.data.endLocation.country._id"></PlaceElement>
                <i class="bi bi-arrow-right mx-2"></i>
                <PlaceElement :place="row.data.endLocation"
                  :showCountry="row.data.startLocation.country._id != row.data.endLocation.country._id"></PlaceElement>
              </div>
            </div>
            <!-- Expence -->
            <div v-else-if="row.type === 'expence'" class="row align-items-center ps-4 mb-1" style="cursor: pointer;"
              @click="showModal('edit', row.data, 'expence')">
              <div class="col-auto fs-3">
                <i class="bi bi-coin"></i>
              </div>
              <div class="col-auto">
                {{row.data.description}}
              </div>
              <div class="col-auto text-secondary">{{ getMoneyString(row.data.cost) }}</div>
            </div>
            <!-- Date -->
            <div v-if="row.gap" class="row ps-5">
              <div class="col-auto">
                <button class="btn btn-sm btn-light" @click="showModal('add', row.gapStage, 'stage')" style="border-radius: 50%;">
                  <i class="bi bi-plus-lg"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="col">
          <div class="card">
            <div class="card-body">
              <h5 class="card-title">{{ $t('labels.summary') }}</h5>
              <div>
                <table class="table align-bottom">
                  <tbody>
                    <tr>
                      <th>{{ $t('labels.progress') }}</th>
                      <td class="text-end"><ProgressCircle :progress="travel.progress"></ProgressCircle></td>
                    </tr>
                    <!-- baseCurrency -->
                    <tr>
                      <td><small>{{ $t('labels.lumpSums') }}</small></td>
                      <td class="text-end"><small>{{ getMoneyString(getLumpSumsSum())
                      }}</small></td>
                    </tr>
                    <tr>
                      <td><small>{{ $t('labels.expences') }}</small></td>
                      <td class="text-end"><small>{{ getMoneyString(getExpencesSum()) }}</small></td>
                    </tr>
                    <tr v-if="travel.advance.amount > 0">
                      <td class="text-secondary"><small>{{ $t('labels.advance') }}</small></td>
                      <td class="text-end text-secondary"><small>{{ getMoneyString(travel.advance, true, (x) => 0 - x)
                      }}</small></td>
                    </tr>
                    <tr>
                      <th>{{ $t('labels.total') }}</th>
                      <td class="text-end">{{ getMoneyString(travel.advance, true, (x) => getExpencesSum().amount + getLumpSumsSum().amount - x) }}</td>
                    </tr>
                  </tbody>
                </table>
                <div class="mb-3">
                  <label for="comment" class="form-label">{{ $t('labels.comment') }}</label>
                  <textarea class="form-control" id="comment" rows="1" v-model="travel.comment"
                    :disabled="isReadOnly && endpointMiddleware !== 'examine/'"></textarea>
                </div>
                <button v-if="travel.state === 'approved'" class="btn btn-primary" @click="isReadOnly ? null : toExamination()"
                  :disabled="isReadOnly || travel.stages.length < 1">
                  <i class="bi bi-pencil-square"></i>
                  <span class="ms-1">{{ $t('labels.toExamination') }}</span>
                </button>
                <button v-else-if="endpointMiddleware === 'examine/'" class="btn btn-success" @click="refund()">
                  <i class="bi bi-coin"></i>
                  <span class="ms-1">{{ $t('labels.refund') }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>


    </div>
  </div>
</template>

<script>
import { Modal } from 'bootstrap'
import StatePipeline from './Elements/StatePipeline.vue'
import ProgressCircle from './Elements/ProgressCircle.vue'
import StageForm from './Forms/StageForm.vue'
import ExpenceForm from './Forms/ExpenceForm.vue'
import InfoPoint from './Elements/InfoPoint.vue'
import PlaceElement from './Elements/PlaceElement.vue'
import { getMoneyString } from '../scripts.js'
export default {
  name: 'TravelPage',
  data() {
    return {
      travel: undefined,
      modal: undefined,
      modalObject: undefined,
      modalMode: 'add',
      modalObjectType: 'stage',
      table: [],
      configCateringRefund: false,
      isReadOnly: false
    }
  },
  components: { StatePipeline, StageForm, InfoPoint, PlaceElement, ProgressCircle, ExpenceForm },
  props: { _id: { type: String }, parentPages: { type: Array }, endpointMiddleware: { type: String, default: '' } },
  methods: {
    showModal(mode, object, type) {
      this.modalObjectType = type
      this.modalObject = object
      this.modalMode = mode
      this.modal.show()
    },
    hideModal() {
      this.modal.hide()
      if (this.$refs.stageForm) {
        this.$refs.stageForm.clear()
      }
      if (this.$refs.expenceForm) {
        this.$refs.expenceForm.clear()
      }
      this.modalObject = undefined
    },
    async postTravelSettings() {
      const travel = {
        _id: this.travel._id,
        claimOvernightLumpSum: this.travel.claimOvernightLumpSum,
        claimSpouseRefund: this.travel.claimSpouseRefund,
        days: this.travel.days
      }
      const result = await this.$root.setter('travel', travel)
      if (result) {
        await this.getTravel()
      } else {
        await this.getTravel()
      }
    },
    async deleteTravel() {
      const result = await this.$root.deleter('travel', { id: this._id })
      if (result) {
        this.$router.push({ path: '/' })
      }
    },
    async toExamination() {
      const result = await this.$root.setter('travel/underExamination', { _id: this.travel._id, comment: this.travel.comment })
      if (result) {
        this.$router.push({ path: '/' })
      }
    },
    async refund() {
      const result = await this.$root.setter('examine/travel/refunded', { _id: this.travel._id, comment: this.travel.comment })
      if (result) {
        this.$router.push({ path: '/examine' })
      }
    },
    async postStage(stage) {
      var headers = {}
      if (stage.cost.receipts) {
        headers = {
          'Content-Type': 'multipart/form-data'
        }
      }
      stage.travelId = this.travel._id
      const result = await this.$root.setter(this.endpointMiddleware + 'travel/stage', stage, { headers })
      if (result) {
        await this.getTravel()
        this.hideModal()
      }
    },
    async deleteStage(id) {
      const result = await this.$root.deleter(this.endpointMiddleware + 'travel/stage', { id: id, travelId: this._id })
      if (result) {
        await this.getTravel()
        this.hideModal()
      }
    },
    async postExpence(stage) {
      var headers = {}
      if (stage.cost.receipts) {
        headers = {
          'Content-Type': 'multipart/form-data'
        }
      }
      stage.travelId = this.travel._id
      const result = await this.$root.setter(this.endpointMiddleware + 'travel/expence', stage, { headers })
      if (result) {
        await this.getTravel()
        this.hideModal()
      }
    },
    async deleteExpence(id) {
      const result = await this.$root.deleter(this.endpointMiddleware + 'travel/expence', { id: id, travelId: this._id })
      if (result) {
        await this.getTravel()
        this.hideModal()
      }
    },
    async deleteReceipt(id, recordId, recordType) {
      const params = { id: id, travelId: this._id }
      params[recordType + 'Id'] = recordId
      const result = await this.$root.deleter(this.endpointMiddleware + 'travel/' + recordType + '/receipt', params)
      if (result) {
        await this.getTravel()
      }
    },
    async showReceipt(id, recordId, recordType) {
      const params = { id: id, travelId: this._id }
      params[recordType + 'Id'] = recordId
      const result = await this.$root.getter(this.endpointMiddleware + 'travel/' + recordType + '/receipt', params, { responseType: 'blob' })
      if (result) {
        const fileURL = URL.createObjectURL(result);
        window.open(fileURL)
      }
    },
    getStageIcon(stage) {
      var icon = null
      if (stage.transport == 'ownCar') {
        icon = 'bi bi-car-front'
      } else if (stage.transport == 'airplane') {
        icon = 'bi bi-airplane'
      } else if (stage.transport == 'shipOrFerry') {
        icon = 'bi bi-water'
      } else if (stage.transport == 'otherTransport') {
        icon = 'bi bi-train-front'
      }
      return icon
    },
    getLumpSumsSum() {
      var sum = 0
      for (const day of this.travel.days) {
        for (const refund of day.refunds) {
          sum += refund.refund.amount
        }
      }
      // baseCurrency
      return { amount: sum, currency: { _id: "EUR" } }
    },
    getExpencesSum() {
      var sum = 0
      for (const stage of this.travel.stages){
        if(stage.cost && stage.cost.amount > 0){
          sum += stage.cost.exchangeRate ? stage.cost.exchangeRate.amount : stage.cost.amount
        }
      }
      for (const expence of this.travel.expences){
        if(expence.cost && expence.cost.amount > 0){
          sum += expence.cost.exchangeRate ? expence.cost.exchangeRate.amount : expence.cost.amount
        }
      }
      // baseCurrency
      return { amount: sum, currency: { _id: "EUR" } }
    },
    renderTable() {
      this.table = []
      var stageIndex = 0;
      for(const expence of this.travel.expences){
        if(this.travel.days.length === 0 || expence.cost.date < this.travel.days[0].date){
          this.table.push({type: 'expence', data: expence})
        }
      }
      for (var i = 0; i < this.travel.days.length; i++) {
        var stagesStart = stageIndex
        while (stageIndex < this.travel.stages.length && i < this.travel.days.length - 1 && new Date(this.travel.days[i + 1].date).valueOf() - new Date(this.travel.stages[stageIndex].startDate).valueOf() > 0) {
          stageIndex++
        }
        var stagesEnd = stageIndex
        if (i == this.travel.days.length - 1) {
          stagesEnd = this.travel.stages.length
        }
        this.table.push({ type: 'day', data: this.travel.days[i] })
        for(const expence of this.travel.expences){
          if(expence.cost.date == this.travel.days[i].date){
            this.table.push({type: 'expence', data: expence})
          }
        }
        for (const stage of this.travel.stages.slice(stagesStart, stagesEnd)) {
          this.table.push({ type: 'stage', data: stage })
        }
      }
      if(this.travel.days.length !== 0){
        for(const expence of this.travel.expences){
          if(expence.cost.date > this.travel.days[this.travel.days.length - 1].date){
            this.table.push({type: 'expence', data: expence})
          }
        }
      }
      
    },
    async getTravel() {
      this.travel = (await this.$root.getter(this.endpointMiddleware + 'travel', { id: this._id, stages: true, days: true })).data
      this.renderTable()
    },
    getMoneyString
  },
  async beforeMount() {
    await this.$root.load()
    await this.getTravel()
    this.isReadOnly = ['underExamination', 'refunded'].indexOf(this.travel.state) !== -1
  },
  mounted() {
    this.modal = new Modal(document.getElementById('modal'), {})
  },
  watch: {
    // travel: function () {
    //   this.renderTable()
    // },
  },
}
</script>

<style></style>