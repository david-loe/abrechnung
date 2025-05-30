<template>
  <div>
    <ModalComponent
      :header="modalTravel.state ? modalTravel.name : $t('labels.newX', { X: $t('labels.travel') })"
      ref="modalComp"
      @afterClose="modalMode === 'view' ? resetModal() : null">
      <div v-if="modalTravel">
        <TravelApproveForm
          v-if="modalTravel.state === 'appliedFor'"
          :travel="(modalTravel as TravelSimple)"
          :loading="modalFormIsLoading"
          @cancel="resetAndHide()"
          @decision="(d, c) => approveTravel((modalTravel as TravelSimple)!, d, c)"></TravelApproveForm>
        <TravelApply v-else-if="modalTravel.state === 'approved'" :travel="(modalTravel as TravelSimple)"></TravelApply>
        <TravelApplyForm
          v-else-if="modalMode !== 'view'"
          :mode="modalMode"
          :travel="modalTravel"
          minStartDate=""
          :loading="modalFormIsLoading"
          endpoint-prefix="examine/"
          @cancel="resetAndHide()"
          @add="(t) => approveTravel(t, 'approved')">
        </TravelApplyForm>
      </div>
    </ModalComponent>
    <div class="container py-3">
      <div class="row mb-3 justify-content-end gx-4 gy-2">
        <div class="col-auto me-auto">
          <h2>{{ $t('accesses.approve/travel') }}</h2>
        </div>
        <div class="col-auto">
          <button class="btn btn-secondary" @click="showModal('add', undefined)">
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
        :columns-to-hide="[
          'state',
          'editor',
          'addUp.totalTotal',
          'addUp.totalBalance',
          'updatedAt',
          'report',
          'organisation',
          'bookingRemark'
        ]"></TravelList>
      <button v-if="!show" type="button" class="btn btn-light" @click="show = 'approved'">
        {{ $t('labels.show') }} <StateBadge state="approved"></StateBadge> <i class="bi bi-chevron-down"></i>
      </button>
      <template v-else>
        <button type="button" class="btn btn-light" @click="show = null">
          {{ $t('labels.hide') }} <StateBadge :state="show"></StateBadge> <i class="bi bi-chevron-up"></i>
        </button>
        <hr class="hr" />
        <TravelList
          endpoint="approve/travel"
          stateFilter="approved"
          :columns-to-hide="['state', 'addUp.totalTotal', 'addUp.totalBalance', 'updatedAt', 'report', 'organisation', 'bookingRemark']">
        </TravelList>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import { TravelSimple } from '@/../../common/types.js'
import API from '@/api.js'
import APP_LOADER from '@/appData.js'
import ModalComponent from '@/components/elements/ModalComponent.vue'
import StateBadge from '@/components/elements/StateBadge.vue'
import TravelList from '@/components/travel/TravelList.vue'
import TravelApply from '@/components/travel/elements/TravelApplication.vue'
import TravelApplyForm from '@/components/travel/forms/TravelApplyForm.vue'
import TravelApproveForm from '@/components/travel/forms/TravelApproveForm.vue'
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'ApprovePage',
  components: { TravelList, TravelApproveForm, TravelApply, TravelApplyForm, ModalComponent, StateBadge },
  props: { _id: { type: String } },
  data() {
    return {
      modalTravel: {} as Partial<TravelSimple>,
      modalMode: 'view' as 'view' | 'add',
      show: null as 'approved' | null,
      modalFormIsLoading: false
    }
  },
  methods: {
    showModal(mode: 'view' | 'add', travel?: Partial<TravelSimple>) {
      if (travel) {
        this.modalTravel = travel
      }
      this.modalMode = mode
      if ((this.$refs.modalComp as typeof ModalComponent).modal) {
        ;(this.$refs.modalComp as typeof ModalComponent).modal.show()
      }
    },
    hideModal() {
      ;(this.$refs.modalComp as typeof ModalComponent).hideModal()
      this.$router.push('/approve/travel')
    },
    resetModal() {
      this.modalTravel = {}
      this.modalMode = 'view'
    },
    resetAndHide() {
      this.resetModal()
      this.hideModal()
    },
    async approveTravel(travel: TravelSimple, decision: 'approved' | 'rejected', comment?: string) {
      if (travel) {
        travel.comment = comment
        this.modalFormIsLoading = true
        const result = await API.setter<TravelSimple>(`approve/travel/${decision}`, travel)
        this.modalFormIsLoading = false
        if (result.ok) {
          ;(this.$refs.travelListRef as typeof TravelList).loadFromServer()
          this.resetAndHide()
        }
      }
    },
    async showTravel(_id: string) {
      const result = await API.getter<TravelSimple>('approve/travel', { _id })
      if (result.ok) {
        this.showModal('view', result.ok.data)
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
