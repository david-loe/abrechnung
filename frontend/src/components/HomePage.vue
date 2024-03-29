<template>
  <div>
    <div class="modal fade" id="modal" tabindex="-1" aria-labelledby="newTravelModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg modal-fullscreen-sm-down">
        <div class="modal-content">
          <div class="modal-header">
            <h5 v-if="modalMode === 'add'" class="modal-title">{{ $t('labels.newX', { X: $t('labels.' + modalObjectType) }) }}</h5>
            <h5 v-else-if="modalObject" class="modal-title">{{ modalObject.name }}</h5>
            <button type="button" class="btn-close" @click="hideModal()"></button>
          </div>
          <div v-if="modalObject" class="modal-body">
            <template v-if="modalObjectType === 'travel'">
              <TravelApplication
                v-if="modalMode === 'view'"
                :travel="modalObject as TravelSimple"
                @cancel="hideModal()"
                @edit="showModal('edit', modalObject, 'travel')"
                @deleted="deleteTravel"></TravelApplication>
              <TravelApplyForm
                v-else
                :mode="modalMode"
                @cancel="hideModal()"
                :travel="modalObject as Partial<TravelSimple>"
                @add="applyForTravel"
                @edit="applyForTravel"
                ref="travelApplyForm"></TravelApplyForm>
            </template>
            <ExpenseReportForm
              v-else-if="modalObjectType === 'expenseReport'"
              :mode="modalMode as 'add' | 'edit'"
              :expenseReport="modalObject as Partial<ExpenseReportSimple>"
              @cancel="hideModal()"
              @add="addExpenseReport"></ExpenseReportForm>
            <HealthCareCostForm
              v-else
              :mode="modalMode as 'add' | 'edit'"
              :healthCareCost="modalObject as Partial<HealthCareCostSimple>"
              @cancel="hideModal()"
              @add="addHealthCareCost"></HealthCareCostForm>
          </div>
        </div>
      </div>
    </div>
    <div v-if="$root.settings._id" class="container">
      <div class="row mb-3 justify-content-end gx-4 gy-2">
        <div class="col-auto me-auto">
          <h1>{{ $t('headlines.home') }}</h1>
        </div>
        <div v-if="!$root.settings.disableReportType.travel && $root.user.access['appliedFor:travel']" class="col-auto">
          <button class="btn btn-secondary" @click="showModal('add', {}, 'travel')">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">{{ $t('labels.applyForX', { X: $t('labels.travel') }) }}</span>
          </button>
        </div>
        <div v-if="!$root.settings.disableReportType.expenseReport && $root.user.access['inWork:expenseReport']" class="col-auto">
          <button class="btn btn-secondary" @click="showModal('add', {}, 'expenseReport')">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">{{ $t('labels.addX', { X: $t('labels.expenseReport') }) }}</span>
          </button>
        </div>
        <div v-if="!$root.settings.disableReportType.healthCareCost && $root.user.access['inWork:healthCareCost']" class="col-auto">
          <button class="btn btn-secondary" @click="showModal('add', {}, 'healthCareCost')">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">{{ $t('labels.submitX', { X: $t('labels.healthCareCost') }) }}</span>
          </button>
        </div>
      </div>
      <template v-if="!$root.settings.disableReportType.travel">
        <h3>{{ $t('labels.travel') }}</h3>
        <TravelCardList
          class="mb-4"
          ref="travelList"
          endpoint="travel"
          :showDropdown="true"
          @clicked="(t) => clickTravelCard(t)"
          @edit="(t) => showModal('edit', t, 'travel')"></TravelCardList>
      </template>
      <template v-if="!$root.settings.disableReportType.expenseReport">
        <h3>{{ $t('labels.expenses') }}</h3>
        <ExpenseReportCardList
          class="mb-4"
          ref="expenseReportList"
          endpoint="expenseReport"
          :showDropdown="true"
          @clicked="(e) => $router.push('/expenseReport/' + e._id)"></ExpenseReportCardList>
      </template>
      <template v-if="!$root.settings.disableReportType.healthCareCost">
        <h3>{{ $t('labels.healthCareCost') }}</h3>
        <HealthCareCostCardList
          ref="healthCareCostList"
          endpoint="healthCareCost"
          :showDropdown="true"
          @clicked="(e) => $router.push('/healthCareCost/' + e._id)"></HealthCareCostCardList>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import { Modal } from 'bootstrap'
import { defineComponent } from 'vue'
import { ExpenseReportSimple, HealthCareCostSimple, TravelSimple } from '../../../common/types.js'
import ExpenseReportCardList from './expenseReport/elements/ExpenseReportCardList.vue'
import ExpenseReportForm from './expenseReport/forms/ExpenseReportForm.vue'
import HealthCareCostCardList from './healthCareCost/elements/HealthCareCostCardList.vue'
import HealthCareCostForm from './healthCareCost/forms/HealthCareCostForm.vue'
import TravelApplication from './travel/elements/TravelApplication.vue'
import TravelCardList from './travel/elements/TravelCardList.vue'
import TravelApplyForm from './travel/forms/TravelApplyForm.vue'

type ModalMode = 'view' | 'add' | 'edit'
type ModalObjectType = 'travel' | 'expenseReport' | 'healthCareCost'
type ModalObject = Partial<TravelSimple> | Partial<ExpenseReportSimple> | Partial<HealthCareCostSimple> | undefined

export default defineComponent({
  name: 'HomePage',
  components: {
    TravelCardList,
    TravelApplyForm,
    TravelApplication,
    ExpenseReportCardList,
    ExpenseReportForm,
    HealthCareCostCardList,
    HealthCareCostForm
  },
  props: [],
  data() {
    return {
      modal: undefined as Modal | undefined,
      modalMode: 'add' as ModalMode,
      modalObject: undefined as ModalObject,
      modalObjectType: 'travel'
    }
  },
  methods: {
    clickTravelCard(travel: TravelSimple) {
      if (['appliedFor', 'rejected'].indexOf(travel.state) > -1) {
        this.showModal('view', travel, 'travel')
      } else {
        this.$router.push(`/travel/${travel._id}`)
      }
    },
    showModal(mode: ModalMode, object: ModalObject, type: ModalObjectType) {
      this.modalObjectType = type
      this.modalObject = object
      this.modalMode = mode
      if (this.modal) {
        this.modal.show()
      }
    },
    hideModal() {
      if (this.modal) {
        this.modal.hide()
      }
      if (this.$refs.travelApplyForm) {
        ;(this.$refs.travelApplyForm as typeof TravelApplyForm).clear()
      }
      this.modalObject = undefined
    },
    async applyForTravel(travel: TravelSimple) {
      const result = (await this.$root.setter<TravelSimple>('travel/appliedFor', travel)).ok
      if (result) {
        if (this.$refs.travelList) {
          ;(this.$refs.travelList as typeof TravelCardList).getData()
        }
        this.hideModal()
      }
    },
    async addExpenseReport(expenseReport: ExpenseReportSimple) {
      const result = (await this.$root.setter<ExpenseReportSimple>('expenseReport/inWork', expenseReport)).ok
      if (result) {
        if (this.$refs.expenseReportList) {
          ;(this.$refs.expenseReportList as typeof ExpenseReportCardList).getData()
        }
        this.hideModal()
        this.$router.push('/expenseReport/' + result._id)
      }
    },
    async addHealthCareCost(healthCareCost: HealthCareCostSimple) {
      const result = (await this.$root.setter<HealthCareCostSimple>('healthCareCost/inWork', healthCareCost)).ok
      if (result) {
        if (this.$refs.healthCareCostList) {
          ;(this.$refs.healthCareCostList as typeof HealthCareCostCardList).getData()
        }
        this.hideModal()
        this.$router.push('/healthCareCost/' + result._id)
      }
    },
    async deleteTravel(_id: string) {
      const result = await this.$root.deleter('travel', { _id })
      if (result) {
        if (this.$refs.travelList) {
          ;(this.$refs.travelList as typeof TravelCardList).getData()
        }
        this.hideModal()
      }
    }
  },
  mounted() {
    const modalEL = document.getElementById('modal')
    if (modalEL) {
      this.modal = new Modal(modalEL, {})
    }
  },
  async created() {
    await this.$root.load()
  }
})
</script>

<style></style>
