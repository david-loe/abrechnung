<template>
  <div>
    <ModalComponent
      ref="modalComp"
      :header="modalMode === 'add' ? $t('labels.newX', { X: $t('labels.' + modalObjectType) }) : modalObject ? modalObject.name : ''"
      @reset="resetForms()">
      <div v-if="modalObject">
        <template v-if="modalObjectType === 'travel'">
          <TravelApplication
            v-if="modalMode === 'view'"
            :travel="modalObject as TravelSimple"
            @cancel="hideModal()"
            @edit="showModal('edit', modalObject, 'travel')"
            @deleted="deleteTravel">
          </TravelApplication>
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
          @add="addExpenseReport">
        </ExpenseReportForm>
        <HealthCareCostForm
          v-else
          :mode="modalMode as 'add' | 'edit'"
          :healthCareCost="modalObject as Partial<HealthCareCostSimple>"
          @cancel="hideModal()"
          @add="addHealthCareCost">
        </HealthCareCostForm>
      </div>
    </ModalComponent>
    <div v-if="$root.settings._id" class="container">
      <div class="row mb-3 justify-content-end gx-4 gy-2">
        <div class="col-auto me-auto">
          <h1>{{ $t('headlines.home') }}</h1>
        </div>
        <div v-if="!$root.settings.disableReportType.travel && $root.user.access['appliedFor:travel']" class="col-auto">
          <button class="btn btn-secondary" @click="showModal('add', {}, 'travel')" :disabled="$root.isOffline">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">{{
              $t($root.user.access['approved:travel'] ? 'labels.addX' : 'labels.applyForX', { X: $t('labels.travel') })
            }}</span>
          </button>
        </div>
        <div v-if="!$root.settings.disableReportType.expenseReport && $root.user.access['inWork:expenseReport']" class="col-auto">
          <button class="btn btn-secondary" @click="showModal('add', {}, 'expenseReport')" :disabled="$root.isOffline">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">{{ $t('labels.addX', { X: $t('labels.expenseReport') }) }}</span>
          </button>
        </div>
        <div v-if="!$root.settings.disableReportType.healthCareCost && $root.user.access['inWork:healthCareCost']" class="col-auto">
          <button class="btn btn-secondary" @click="showModal('add', {}, 'healthCareCost')" :disabled="$root.isOffline">
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
import { defineComponent } from 'vue'
import { ExpenseReportSimple, HealthCareCostSimple, TravelSimple } from '../../../common/types.js'
import Installation from './elements/Installation.vue'
import ModalComponent from './elements/ModalComponent.vue'
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
    HealthCareCostForm,
    ModalComponent,
    Installation
  },
  props: [],
  data() {
    return {
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
      if ((this.$refs.modalComp as typeof ModalComponent).modal) {
        ;(this.$refs.modalComp as typeof ModalComponent).modal.show()
      }
    },
    hideModal() {
      if ((this.$refs.modalComp as typeof ModalComponent).modal) {
        ;(this.$refs.modalComp as typeof ModalComponent).hideModal()
      }
    },
    resetForms() {
      if (this.$refs.travelApplyForm) {
        ;(this.$refs.travelApplyForm as typeof TravelApplyForm).clear()
      }
      this.modalObject = undefined
    },
    async applyForTravel(travel: TravelSimple) {
      const result = (
        await this.$root.setter<TravelSimple>(this.$root.user.access['approved:travel'] ? 'travel/approved' : 'travel/appliedFor', travel)
      ).ok
      if (result) {
        if (this.$refs.travelList) {
          ;(this.$refs.travelList as typeof TravelCardList).getData()
        }
        ;(this.$refs.modalComp as typeof ModalComponent).hideModal()
      }
    },
    async addExpenseReport(expenseReport: ExpenseReportSimple) {
      const result = (await this.$root.setter<ExpenseReportSimple>('expenseReport/inWork', expenseReport)).ok
      if (result) {
        if (this.$refs.expenseReportList) {
          ;(this.$refs.expenseReportList as typeof ExpenseReportCardList).getData()
        }
        ;(this.$refs.modalComp as typeof ModalComponent).hideModal()
        this.$router.push('/expenseReport/' + result._id)
      }
    },
    async addHealthCareCost(healthCareCost: HealthCareCostSimple) {
      const result = (await this.$root.setter<HealthCareCostSimple>('healthCareCost/inWork', healthCareCost)).ok
      if (result) {
        if (this.$refs.healthCareCostList) {
          ;(this.$refs.healthCareCostList as typeof HealthCareCostCardList).getData()
        }
        ;(this.$refs.modalComp as typeof ModalComponent).hideModal()
        this.$router.push('/healthCareCost/' + result._id)
      }
    },
    async deleteTravel(_id: string) {
      const result = await this.$root.deleter('travel', { _id })
      if (result) {
        if (this.$refs.travelList) {
          ;(this.$refs.travelList as typeof TravelCardList).getData()
        }
        ;(this.$refs.modalComp as typeof ModalComponent).hideModal()
      }
    }
  },
  async created() {
    await this.$root.load()
  }
})
</script>

<style></style>
