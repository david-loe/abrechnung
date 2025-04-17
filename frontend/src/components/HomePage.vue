<template>
  <div>
    <ModalComponent
      ref="modalComp"
      :header="modalMode === 'add' ? $t('labels.newX', { X: $t('labels.' + modalObjectType) }) : modalObject ? modalObject.name : ''"
      @beforeClose="modalMode === 'edit' || modalMode === 'view' ? resetModal() : null">
      <div v-if="modalObject">
        <template v-if="modalObjectType === 'travel'">
          <TravelApplication
            v-if="modalMode === 'view'"
            :travel="(modalObject as TravelSimple)"
            :loading="modalFormIsLoading"
            @cancel="resetAndHide()"
            @edit="showModal('edit', 'travel', modalObject)"
            @deleted="deleteTravel">
          </TravelApplication>
          <TravelApplyForm
            v-else
            :mode="modalMode"
            @cancel="resetAndHide()"
            :travel="(modalObject as Partial<TravelSimple>)"
            :loading="modalFormIsLoading"
            @add="applyForTravel"
            @edit="applyForTravel"
            ref="travelApplyForm"></TravelApplyForm>
        </template>
        <ExpenseReportForm
          v-else-if="modalObjectType === 'expenseReport'"
          :mode="(modalMode as 'add' | 'edit')"
          :expenseReport="(modalObject as Partial<ExpenseReportSimple>)"
          :loading="modalFormIsLoading"
          @cancel="resetAndHide()"
          @add="addExpenseReport">
        </ExpenseReportForm>
        <HealthCareCostForm
          v-else
          :mode="(modalMode as 'add' | 'edit')"
          :healthCareCost="(modalObject as Partial<HealthCareCostSimple>)"
          :loading="modalFormIsLoading"
          @cancel="resetAndHide()"
          @add="addHealthCareCost">
        </HealthCareCostForm>
      </div>
    </ModalComponent>
    <div v-if="APP_DATA" class="container py-3">
      <div class="row mb-3 justify-content-end gx-4 gy-2">
        <div class="col-auto me-auto">
          <h2>{{ $t('headlines.home') }}</h2>
        </div>
        <div v-if="!APP_DATA.settings.disableReportType.travel && APP_DATA.user.access['appliedFor:travel']" class="col-auto">
          <button class="btn btn-secondary" @click="showModal('add', 'travel', undefined)">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">{{
              $t(APP_DATA.user.access['approved:travel'] ? 'labels.addX' : 'labels.applyForX', { X: $t('labels.travel') })
            }}</span>
          </button>
        </div>
        <div v-if="!APP_DATA.settings.disableReportType.expenseReport && APP_DATA.user.access['inWork:expenseReport']" class="col-auto">
          <button class="btn btn-secondary" @click="showModal('add', 'expenseReport', undefined)">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">{{ $t('labels.addX', { X: $t('labels.expenseReport') }) }}</span>
          </button>
        </div>
        <div v-if="!APP_DATA.settings.disableReportType.healthCareCost && APP_DATA.user.access['inWork:healthCareCost']" class="col-auto">
          <button class="btn btn-secondary" @click="showModal('add', 'healthCareCost', undefined)">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">{{ $t('labels.submitX', { X: $t('labels.healthCareCost') }) }}</span>
          </button>
        </div>
      </div>
      <template v-if="!APP_DATA.settings.disableReportType.travel">
        <h3>{{ $t('labels.travel') }}</h3>
        <TravelList
          class="mb-4"
          ref="travelList"
          endpoint="travel"
          :columns-to-hide="['owner', 'updatedAt', 'report', 'addUp.total.amount', 'organisation', 'comments']"
          @clicked-applied="(t) => showModal('view', 'travel', t)"></TravelList>
      </template>
      <template v-if="!APP_DATA.settings.disableReportType.expenseReport">
        <h3>{{ $t('labels.expenses') }}</h3>
        <ExpenseReportList
          class="mb-4"
          ref="expenseReportList"
          endpoint="expenseReport"
          :columns-to-hide="['owner', 'updatedAt', 'report', 'addUp.total.amount', 'organisation', 'comments']"></ExpenseReportList>
      </template>
      <template v-if="!APP_DATA.settings.disableReportType.healthCareCost">
        <h3>{{ $t('labels.healthCareCost') }}</h3>
        <HealthCareCostList
          ref="healthCareCostList"
          endpoint="healthCareCost"
          :columns-to-hide="['owner', 'updatedAt', 'report', 'organisation', 'comments', 'log.underExamination.date']"></HealthCareCostList>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import { ExpenseReportSimple, HealthCareCostSimple, TravelSimple } from '@/../../common/types.js'
import API from '@/api.js'
import APP_LOADER from '@/appData.js'
import ModalComponent from '@/components/elements/ModalComponent.vue'
import ExpenseReportList from '@/components/expenseReport/ExpenseReportList.vue'
import ExpenseReportForm from '@/components/expenseReport/forms/ExpenseReportForm.vue'
import HealthCareCostList from '@/components/healthCareCost/HealthCareCostList.vue'
import HealthCareCostForm from '@/components/healthCareCost/forms/HealthCareCostForm.vue'
import TravelList from '@/components/travel/TravelList.vue'
import TravelApplication from '@/components/travel/elements/TravelApplication.vue'
import TravelApplyForm from '@/components/travel/forms/TravelApplyForm.vue'
import { defineComponent } from 'vue'

type ModalMode = 'view' | 'add' | 'edit'
type ModalObjectType = 'travel' | 'expenseReport' | 'healthCareCost'
type ModalObject = Partial<TravelSimple> | Partial<ExpenseReportSimple> | Partial<HealthCareCostSimple>

export default defineComponent({
  name: 'HomePage',
  components: {
    TravelList,
    TravelApplyForm,
    TravelApplication,
    ExpenseReportList,
    ExpenseReportForm,
    HealthCareCostList,
    HealthCareCostForm,
    ModalComponent
  },
  props: [],
  data() {
    return {
      modalMode: 'add' as ModalMode,
      modalObject: {} as ModalObject,
      modalObjectType: 'travel' as ModalObjectType,
      APP_DATA: APP_LOADER.data,
      modalFormIsLoading: false
    }
  },
  methods: {
    showModal(mode: ModalMode, type: ModalObjectType, object?: ModalObject) {
      if (object) {
        this.modalObject = object
      } else if (this.modalObjectType !== type) {
        this.modalObject = {}
      }
      this.modalObjectType = type
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
    resetModal() {
      this.modalObject = {}
      this.modalMode = 'add'
    },
    resetAndHide() {
      this.resetModal()
      this.hideModal()
    },
    async applyForTravel(travel: TravelSimple) {
      this.modalFormIsLoading = true
      const result = (
        await API.setter<TravelSimple>(this.APP_DATA?.user.access['approved:travel'] ? 'travel/approved' : 'travel/appliedFor', travel)
      ).ok
      this.modalFormIsLoading = false
      if (result) {
        ;(this.$refs.travelList as typeof TravelList).loadFromServer()
        this.resetAndHide()
      }
    },
    async addExpenseReport(expenseReport: ExpenseReportSimple) {
      this.modalFormIsLoading = true
      const result = (await API.setter<ExpenseReportSimple>('expenseReport/inWork', expenseReport)).ok
      this.modalFormIsLoading = false
      if (result) {
        ;(this.$refs.expenseReportList as typeof ExpenseReportList).loadFromServer()
        this.resetAndHide()
        this.$router.push(`/expenseReport/${result._id}`)
      }
    },
    async addHealthCareCost(healthCareCost: HealthCareCostSimple) {
      this.modalFormIsLoading = true
      const result = (await API.setter<HealthCareCostSimple>('healthCareCost/inWork', healthCareCost)).ok
      this.modalFormIsLoading = false
      if (result) {
        ;(this.$refs.healthCareCostList as typeof HealthCareCostList).loadFromServer()
        this.resetAndHide()
        this.$router.push(`/healthCareCost/${result._id}`)
      }
    },
    async deleteTravel(_id: string) {
      this.modalFormIsLoading = true
      const result = await API.deleter('travel', { _id })
      this.modalFormIsLoading = false
      if (result) {
        ;(this.$refs.travelList as typeof TravelList).loadFromServer()
        this.resetAndHide()
      }
    }
  },
  async created() {
    await APP_LOADER.loadData()
  }
})
</script>

<style></style>
