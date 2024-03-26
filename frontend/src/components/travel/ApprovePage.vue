<template>
  <div>
    <div class="modal fade" id="approveTravelModal" tabindex="-1" aria-labelledby="approveTravelModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg modal-fullscreen-sm-down">
        <div class="modal-content">
          <div class="modal-header">
            <h5 v-if="modalTravel" class="modal-title">{{ modalTravel.name }}</h5>
            <button type="button" class="btn-close" @click="hideModal()"></button>
          </div>
          <div v-if="modalTravel" class="modal-body">
            <TravelApproveForm
              v-if="modalTravel.state === 'appliedFor'"
              ref="travelApproveForm"
              :travel="modalTravel"
              @cancel="hideModal()"
              @decision="(d,c) => approveTravel(modalTravel, d,c)"></TravelApproveForm>
            <TravelApply v-else-if="modalTravel.state === 'approved'" :travel="modalTravel" :showButtons="false"></TravelApply>
            <TravelApplyForm
                v-else
                :mode="modalMode"
                @cancel="hideModal()"
                :travel="modalTravel as Partial<TravelSimple>"
                @add="(t)=> approveTravel(t, 'approved')"
                @edit="(t)=> approveTravel(t, 'approved')"
                ref="travelApplyForm"
                askOwner></TravelApplyForm>
          </div>
          
        </div>
      </div>
    </div>
    <div class="container">
    <div class="row mb-3 justify-content-end gx-4 gy-2">
        <div class="col-auto me-auto">
          <h1>{{ $t('accesses.approve/travel') }}</h1>
        </div>
        <div class="col-auto">
          <button class="btn btn-secondary" @click="showModal({}, 'add')">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">{{ $t('labels.applyForX', { X: $t('labels.travel') }) }}</span>
          </button>
        </div>
    </div>
      <TravelCardList
        class="mb-5"
        ref="travelCardListRef"
        endpoint="approve/travel"
        :params="params('appliedFor')"
        :showOwner="true"
        :showSearch="true"
        @clicked="(t) => showModal(t)"></TravelCardList>
      <button v-if="!showApproved" type="button" class="btn btn-light" @click="showApproved = true">
        {{ $t('labels.showX', { X: $t('labels.approvedTravels') }) }} <i class="bi bi-chevron-down"></i>
      </button>
      <template v-else>
        <button type="button" class="btn btn-light" @click="showApproved = false">
          {{ $t('labels.hideX', { X: $t('labels.approvedTravels') }) }} <i class="bi bi-chevron-up"></i>
        </button>
        <hr class="hr" />
        <TravelCardList
          endpoint="approve/travel"
          :params="params('approved')"
          :showOwner="true"
          :showSearch="true"
          @clicked="(t) => showModal(t)">
        </TravelCardList>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import { Modal } from 'bootstrap'
import { defineComponent } from 'vue'
import { TravelSimple, TravelState } from '../../../../common/types.js'
import TravelApply from './elements/TravelApplication.vue'
import TravelCardList from './elements/TravelCardList.vue'
import TravelApplyForm from './forms/TravelApplyForm.vue'
import TravelApproveForm from './forms/TravelApproveForm.vue'

export default defineComponent({
  name: 'ApprovePage',
  components: { TravelCardList, TravelApproveForm, TravelApply , TravelApplyForm},
  props: { _id: { type: String } },
  data() {
    return {
      approveTravelModal: undefined as Modal | undefined,
      modalTravel: undefined as TravelSimple | undefined,
      modalMode: 'view' as 'view'|'add'|'edit',
      showApproved: false
    }
  },
  methods: {
    showModal(travel: TravelSimple, mode: 'view'|'add'|'edit' = 'view') {
      this.modalTravel = travel
      this.modalMode = mode
      if (this.approveTravelModal) {
        this.approveTravelModal.show()
      }
    },
    hideModal() {
      if (this.approveTravelModal) {
        this.approveTravelModal.hide()
      }
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
        const result = await this.$root.setter<TravelSimple>('approve/travel/' + decision, travel)
        if (result.ok) {
          ;(this.$refs.travelCardListRef as typeof TravelCardList).getData()
          this.hideModal()
        }
      }
    },
    params(state: TravelState) {
      return { filter: { $and: [{ state }] } }
    }
  },
  async mounted() {
    const modalEl = document.getElementById('approveTravelModal')
    if (modalEl) {
      this.approveTravelModal = new Modal(modalEl, {})
    }
    if (this._id) {
      const result = (await this.$root.getter<TravelSimple>('approve/travel', { _id: this._id })).ok
      if (result) {
        this.showModal(result.data)
      }
    }
  },
  async created() {
    await this.$root.load()
  }
})
</script>

<style></style>
