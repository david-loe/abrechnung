<template>
  <div>
    <div class="modal fade" id="newTravelModal" tabindex="-1" aria-labelledby="newTravelModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg modal-fullscreen-sm-down">
        <div class="modal-content">
          <div class="modal-header">
            <h5 v-if="modalMode === 'add'" class="modal-title">{{ $t('labels.newX', { X: $t('labels.travel') }) }}</h5>
            <h5 v-else-if="modalTravel" class="modal-title">{{ modalTravel.name }}</h5>
            <button type="button" class="btn-close" @click="hideModal()"></button>
          </div>
          <div class="modal-body">
            <TravelApplication
              v-if="modalMode === 'view'"
              :travel="(modalTravel as TravelSimple)"
              @cancel="hideModal()"
              @edit="showModal('edit', modalTravel)"
              @deleted="deleteTravel"></TravelApplication>
            <TravelApplyForm
              v-else
              :mode="modalMode"
              @cancel="hideModal()"
              :travel="modalTravel"
              @add="applyForTravel"
              @edit="applyForTravel"
              ref="travelApplyForm"></TravelApplyForm>
          </div>
        </div>
      </div>
    </div>
    <div class="container">
      <div class="row justify-content-between mb-3">
        <div class="col-auto">
          <h1>{{ $t('headlines.myTravels') }}</h1>
        </div>
        <div class="col-auto">
          <button class="btn btn-secondary" @click="showModal('add', {})">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">{{ $t('labels.applyForX', { X: $t('labels.travel') }) }}</span>
          </button>
        </div>
      </div>
      <TravelCardList
        ref="travelCardListRef"
        endpoint="travel"
        :showDropdown="true"
        @clicked="(t) => clickCard(t)"
        @edit="(t) => showModal('edit', t)"></TravelCardList>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { Modal } from 'bootstrap'
import TravelCardList from './Elements/TravelCardList.vue'
import TravelApplication from './Elements/TravelApplication.vue'
import TravelApplyForm from './Forms/TravelApplyForm.vue'
import { TravelSimple } from '../../../common/types'

export default defineComponent({
  name: 'MyTravelsPage',
  components: { TravelCardList, TravelApplyForm, TravelApplication },
  props: [],
  data() {
    return {
      newTravelModal: undefined as Modal | undefined,
      modalMode: 'add' as 'view' | 'add' | 'edit',
      modalTravel: {} as Partial<TravelSimple>
    }
  },
  methods: {
    clickCard(travel: TravelSimple) {
      if (['appliedFor', 'rejected'].indexOf(travel.state) > -1) {
        this.showModal('view', travel)
      } else {
        this.$router.push(`/travel/${travel._id}`)
      }
    },
    showModal(mode: 'view' | 'add' | 'edit', travel: Partial<TravelSimple>) {
      this.modalMode = mode
      this.modalTravel = travel
      if (this.newTravelModal) {
        this.newTravelModal.show()
      }
    },
    hideModal() {
      if (this.newTravelModal) {
        this.newTravelModal.hide()
      }
      if (this.$refs.travelApplyForm) {
        ;(this.$refs.travelApplyForm as typeof TravelApplyForm).clear()
      }
      this.modalTravel = {}
    },
    async applyForTravel(travel: TravelSimple) {
      const result = await this.$root.setter('travel/appliedFor', travel)
      if (result) {
        if (this.$refs.travelCardListRef) {
          ;(this.$refs.travelCardListRef as typeof TravelCardList).getTravels()
        }
        this.hideModal()
      }
    },
    async deleteTravel(id: string) {
      const result = await this.$root.deleter('travel', { id: id })
      if (result) {
        if (this.$refs.travelCardListRef) {
          ;(this.$refs.travelCardListRef as typeof TravelCardList).getTravels()
        }
        this.hideModal()
      }
    }
  },
  mounted() {
    const modalEL = document.getElementById('newTravelModal')
    if (modalEL) {
      this.newTravelModal = new Modal(modalEL, {})
    }
  },
  async beforeMount() {
    await this.$root.load()
  }
})
</script>

<style></style>
