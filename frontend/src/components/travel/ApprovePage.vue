<template>
  <div>
    <ModalComponent
      :header="modalTravel && modalTravel.state ? modalTravel.name : $t('labels.newX', { X: $t('labels.travel') })"
      ref="modalComp"
      @close="resetForms()">
      <div v-if="modalTravel">
        <TravelApproveForm
          v-if="modalTravel.state === 'appliedFor'"
          ref="travelApproveForm"
          :travel="modalTravel"
          @cancel="hideModal()"
          @decision="(d, c) => approveTravel(modalTravel!, d, c)"></TravelApproveForm>
        <TravelApply v-else-if="modalTravel.state === 'approved'" :travel="modalTravel" :showButtons="false"></TravelApply>
        <TravelApplyForm
          v-else-if="modalMode !== 'view'"
          :mode="modalMode"
          @cancel="hideModal()"
          :travel="modalTravel as Partial<TravelSimple>"
          @add="(t) => approveTravel(t, 'approved')"
          @edit="(t) => approveTravel(t, 'approved')"
          ref="travelApplyForm"
          minStartDate=""
          askOwner></TravelApplyForm>
      </div>
    </ModalComponent>
    <div class="container">
      <div class="row mb-3 justify-content-end gx-4 gy-2">
        <div class="col-auto me-auto">
          <h1>{{ $t('accesses.approve/travel') }}</h1>
        </div>
        <div class="col-auto">
          <button class="btn btn-secondary" @click="showModal({} as TravelSimple, 'add')">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">{{ $t('labels.createX', { X: $t('labels.travel') }) }}</span>
          </button>
        </div>
      </div>
      <TravelList
        class="mb-5"
        ref="travelListRef"
        endpoint="approve/travel"
        stateFilter="appliedFor"
        :columns-to-hide="['state', 'editor', 'addUp']"></TravelList>
      <button v-if="!showApproved" type="button" class="btn btn-light" @click="showApproved = true">
        {{ $t('labels.showX', { X: $t('labels.approvedTravels') }) }} <i class="bi bi-chevron-down"></i>
      </button>
      <template v-else>
        <button type="button" class="btn btn-light" @click="showApproved = false">
          {{ $t('labels.hideX', { X: $t('labels.approvedTravels') }) }} <i class="bi bi-chevron-up"></i>
        </button>
        <hr class="hr" />
        <TravelList endpoint="approve/travel" stateFilter="approved" :columns-to-hide="['state', 'addUp']"> </TravelList>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import API from '@/api.js'
import APP_LOADER from '@/appData.js'
import { defineComponent } from 'vue'
import { TravelSimple } from '../../../../common/types.js'
import ModalComponent from '../elements/ModalComponent.vue'
import TravelApply from './elements/TravelApplication.vue'
import TravelApplyForm from './forms/TravelApplyForm.vue'
import TravelApproveForm from './forms/TravelApproveForm.vue'
import TravelList from './TravelList.vue'

export default defineComponent({
  name: 'ApprovePage',
  components: { TravelList, TravelApproveForm, TravelApply, TravelApplyForm, ModalComponent },
  props: { _id: { type: String } },
  data() {
    return {
      modalTravel: undefined as TravelSimple | undefined,
      modalMode: 'view' as 'view' | 'add' | 'edit',
      showApproved: false
    }
  },
  methods: {
    showModal(travel: TravelSimple, mode: 'view' | 'add' | 'edit' = 'view') {
      this.modalTravel = travel
      this.modalMode = mode
      if ((this.$refs.modalComp as typeof ModalComponent).modal) {
        ;(this.$refs.modalComp as typeof ModalComponent).modal.show()
      }
    },
    hideModal() {
      ;(this.$refs.modalComp as typeof ModalComponent).hideModal()
      this.$router.push('/approve/travel')
    },
    resetForms() {
      this.hideModal()
      if (this.$refs.travelApproveForm) {
        ;(this.$refs.travelApproveForm as typeof TravelApproveForm).clear()
      }
      if (this.$refs.travelApplyForm) {
        ;(this.$refs.travelApplyForm as typeof TravelApplyForm).clear()
      }
      this.modalTravel = undefined
    },
    async approveTravel(travel: TravelSimple, decision: 'approved' | 'rejected', comment?: string) {
      if (travel) {
        travel.comment = comment
        const result = await API.setter<TravelSimple>('approve/travel/' + decision, travel)
        if (result.ok) {
          ;(this.$refs.travelListRef as typeof TravelList).loadFromServer()
          this.hideModal()
        } else {
          ;(this.$refs.travelApplyForm as typeof TravelApplyForm).loading = false
        }
      }
    },
    async showTravel(_id: string) {
      const result = await API.getter<TravelSimple>('approve/travel', { _id })
      if (result.ok) {
        this.showModal(result.ok.data)
      }
    }
  },
  async mounted() {
    if (this._id) {
      this.showTravel(this._id)
    }
  },
  async created() {
    await APP_LOADER.loadData()
  },
  watch: {
    _id: function (value) {
      this.showTravel(value)
    }
  }
})
</script>

<style></style>
