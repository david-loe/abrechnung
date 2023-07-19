<template>
  <div>
    <TravelApply :travel="travel" :showButtons="false"></TravelApply>
    <div class="mb-3">
      <label for="comment" class="form-label">{{ $t('labels.comment') }}</label>
      <textarea class="form-control" id="comment" rows="3" v-model="comment"></textarea>
    </div>
    <div class="mb-2">
      <button type="submit" class="btn btn-success me-2" @click="$emit('decision', 'approved', comment)">
        {{ $t('labels.approve') }}
      </button>
      <button type="button" class="btn btn-danger me-2" @click="$emit('decision', 'rejected', comment)">
        {{ $t('labels.reject') }}
      </button>
      <button type="button" class="btn btn-light" v-on:click="$emit('cancel')">
        {{ $t('labels.cancel') }}
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import TravelApply from '../Elements/TravelApplication.vue'
import { TravelSimple } from '../../../../common/types'
export default defineComponent({
  name: 'InfoPoint',
  data() {
    return {
      comment: ''
    }
  },
  components: { TravelApply },
  props: { travel: { type: Object as PropType<TravelSimple>, required: true } },
  emits: ['decision', 'cancel'],
  methods: {
    clear() {
      this.comment = ''
    }
  }
})
</script>

<style></style>
