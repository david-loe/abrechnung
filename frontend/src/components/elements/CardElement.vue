<template>
  <div class="card" style="width: 18rem; cursor: pointer" @click="$emit('clicked')">
    <div class="card-body">
      <div class="row">
        <div class="col">
          <h5 class="card-title">{{ request.name }}</h5>
        </div>
        <div class="col-auto">
          <slot name="top-right"></slot>
        </div>
        <div v-if="showDropdown" class="col-auto">
          <div class="dropdown" @click="(e) => e.stopPropagation()">
            <a class="nav-link link-dark" data-bs-toggle="dropdown" data-bs-auto-close="outside" href="#" role="button">
              <i class="bi bi-three-dots-vertical"></i>
            </a>
            <ul class="dropdown-menu dropdown-menu-end">
              <slot name="dropdown-items"></slot>
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

      <span v-if="showOwner && request.owner" class="card-subtitle mb-1 fs-6 fw-medium text-muted">
        {{ request.owner.name.givenName + ' ' + request.owner.name.familyName + ' - ' + request.organisation.name }}
      </span>
      <div class="row mb-2">
        <slot name="details"></slot>
      </div>

      <div class="row">
        <div class="col"><StateBadge :state="request.state"></StateBadge></div>
        <div v-if="showEditor" class="col-auto">
          <small class="ms-1">
            <i class="bi bi-pencil-square"></i>
            {{ request.editor.name.givenName }}
          </small>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { RequestSimple } from '../../../../common/types.js'
import ProgressCircle from './ProgressCircle.vue'
import StateBadge from './StateBadge.vue'

export default defineComponent({
  name: 'CardElement',
  emits: ['clicked', 'deleted'],
  components: { StateBadge, ProgressCircle },
  props: {
    request: { type: Object as PropType<RequestSimple>, required: true },
    showOwner: { type: Boolean, default: false },
    showEditor: { type: Boolean, default: false },
    showDropdown: { type: Boolean, default: false }
  },
  methods: {}
})
</script>

<style></style>
