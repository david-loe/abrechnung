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

<script>
import TravelApply from '../Elements/TravelApplication.vue'
export default {
  name: 'InfoPoint',
  data() {
    return {
      comment: null,
    }
  },
  components: { TravelApply },
  props: { travel: { type: Object } },
  emits: ['decision', 'cancel'],
  methods:{
    clear() {
      this.comment = null
    }
  }
}
</script>

<style>
</style>