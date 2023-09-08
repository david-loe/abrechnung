<template>
  <div class="card" style="width: 18rem; cursor: pointer" @click="$emit('clicked')">
    <div class="card-body">
      <div class="row">
        <div class="col">
          <h5 class="card-title">{{ travel.name }}</h5>
        </div>
        <div class="col-auto">
          <ProgressCircle v-if="['approved', 'underExamination'].indexOf(travel.state) !== -1" :progress="travel.progress"></ProgressCircle>
        </div>
        <div v-if="showDropdown" class="col-auto">
          <div class="dropdown" @click="(e) => e.stopPropagation()">
            <a class="nav-link link-dark" data-bs-toggle="dropdown" data-bs-auto-close="outside" href="#" role="button">
              <i class="bi bi-three-dots-vertical"></i>
            </a>
            <ul class="dropdown-menu dropdown-menu-end">
              <li>
                <a
                  :class="'dropdown-item' + (['underExamination', 'refunded'].indexOf(travel.state) != -1 ? ' disabled' : '')"
                  href="#"
                  @click=";['underExamination', 'refunded'].indexOf(travel.state) != -1 ? null : $emit('edit')">
                  <span class="me-1"><i class="bi bi-pencil"></i></span>
                  <span>{{ $t('labels.editX', { X: $t('labels.travelDetails') }) }}</span>
                </a>
              </li>
              <li>
                <a class="dropdown-item" href="#" @click="$emit('deleted')">
                  <span class="me-1"><i class="bi bi-trash"></i></span>
                  <span>{{ $t('labels.delete') }}</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <span v-if="showTraveler" class="card-subtitle mb-1 fs-6 fw-medium text-muted">{{ travel.traveler.name }}</span>
      <div class="row mb-2">
        <div class="col-auto">
          <span class="fs-6 fw-medium text-muted">
            {{ datetoDateString(travel.startDate) + ' - ' + datetoDateString(travel.endDate) }}
          </span>
        </div>
        <div v-if="travel.claimSpouseRefund" :title="$t('labels.claimSpouseRefund')" class="col-auto">
          <i class="bi bi-person-plus-fill"></i>
        </div>
      </div>

      <div class="row">
        <div class="col"><StateBadge :state="travel.state"></StateBadge></div>
        <div v-if="travel.traveler._id !== travel.editor._id" class="col-auto">
          <small class="ms-1">
            <i class="bi bi-pencil-square"></i>
            {{ travel.editor.name }}
          </small>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import ProgressCircle from './ProgressCircle.vue'
import StateBadge from './StateBadge.vue'
import { datetoDateString } from '../../../../common/scripts.js'
import { TravelSimple } from '../../../../common/types.js'

export default defineComponent({
  name: 'TravelCard',
  emits: ['clicked', 'deleted', 'edit'],
  components: { StateBadge, ProgressCircle },
  props: {
    travel: { type: Object as PropType<TravelSimple>, required: true },
    showTraveler: { type: Boolean, default: false },
    showDropdown: { type: Boolean, default: false }
  },
  methods: {
    datetoDateString
  }
})
</script>

<style></style>
