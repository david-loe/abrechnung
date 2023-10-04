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
                :travel="(modalObject as TravelSimple)"
                @cancel="hideModal()"
                @edit="showModal('edit', modalObject, 'travel')"
                @deleted="deleteTravel"></TravelApplication>
              <TravelApplyForm
                v-else
                :mode="modalMode"
                @cancel="hideModal()"
                :travel="(modalObject as Partial<TravelSimple>)"
                @add="applyForTravel"
                @edit="applyForTravel"
                ref="travelApplyForm"></TravelApplyForm>
            </template>
            <ExpenseReportForm
              v-else
              :mode="(modalMode as 'add' | 'edit')"
              :expenseReport="(modalObject as Partial<ExpenseReportSimple>)"
              @cancel="hideModal()"
              @add="addExpenseReport"></ExpenseReportForm>
          </div>
        </div>
      </div>
    </div>
    <div class="container">
      <div class="row mb-3">
        <div class="col-auto me-auto">
          <h1>{{ $t('headlines.home') }}</h1>
        </div>
        <div class="col-auto">
          <button class="btn btn-secondary" @click="showModal('add', {}, 'travel')">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">{{ $t('labels.applyForX', { X: $t('labels.travel') }) }}</span>
          </button>
        </div>
        <div class="col-auto">
          <button class="btn btn-secondary" @click="showModal('add', {}, 'expenseReport')">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">{{ $t('labels.addX', { X: $t('labels.expenseReport') }) }}</span>
          </button>
        </div>
      </div>
      <h3>{{ $t('labels.travel') }}</h3>
      <TravelCardList
        class="mb-5"
        ref="travelList"
        endpoint="travel"
        :showDropdown="true"
        @clicked="(t) => clickTravelCard(t)"
        @edit="(t) => showModal('edit', t, 'travel')"></TravelCardList>
      <h3>{{ $t('labels.expenseReport') }}</h3>
      <ExpenseReportCardList
        ref="expenseReportList"
        endpoint="expenseReport"
        :showDropdown="true"
        @clicked="(e) => $router.push('/expenseReport/' + e._id)"></ExpenseReportCardList>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { Modal } from 'bootstrap'
import TravelCardList from './travel/elements/TravelCardList.vue'
import ExpenseReportCardList from './expenseReport/elements/ExpenseReportCardList.vue'
import TravelApplication from './travel/elements/TravelApplication.vue'
import TravelApplyForm from './travel/forms/TravelApplyForm.vue'
import ExpenseReportForm from './expenseReport/forms/ExpenseReportForm.vue'
import { ExpenseReportSimple, TravelSimple } from '../../../common/types.js'

type ModalMode = 'view' | 'add' | 'edit'
type ModalObjectType = 'travel' | 'expenseReport'
type ModalObject = Partial<TravelSimple> | Partial<ExpenseReportSimple> | undefined

export default defineComponent({
  name: 'HomePage',
  components: { TravelCardList, TravelApplyForm, TravelApplication, ExpenseReportCardList, ExpenseReportForm },
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
      const result = await this.$root.setter('travel/appliedFor', travel)
      if (result) {
        if (this.$refs.travelList) {
          ;(this.$refs.travelList as typeof TravelCardList).getData()
        }
        this.hideModal()
      }
    },
    async addExpenseReport(expenseReport: ExpenseReportSimple) {
      const result = await this.$root.setter('expenseReport/inWork', expenseReport)
      if (result) {
        if (this.$refs.expenseReportList) {
          ;(this.$refs.expenseReportList as typeof ExpenseReportCardList).getData()
        }
        this.hideModal()
        this.$router.push('/expenseReport/' + result._id)
      }
    },
    async deleteTravel(id: string) {
      const result = await this.$root.deleter('travel', { id: id })
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
  async beforeMount() {
    await this.$root.load()
  }
})
</script>

<style></style>
