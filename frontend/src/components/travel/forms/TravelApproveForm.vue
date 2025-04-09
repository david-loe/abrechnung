<template>
  <div>
    <TravelApply :travel="travel" :showButtons="false"></TravelApply>
    <div class="mb-3">
      <label for="comment" class="form-label">{{ $t('labels.comment') }}</label>
      <textarea class="form-control" id="comment" rows="3" v-model="comment"></textarea>
    </div>
    <div class="mb-2">
      <button type="submit" class="btn btn-success me-2" @click="output('approved')" :disabled="loading.approved || loading.rejected">
        <span v-if="loading.approved" class="spinner-border spinner-border-sm"></span>
        {{ $t('labels.approve') }}
      </button>
      <button type="button" class="btn btn-danger me-2" @click="output('rejected')" :disabled="loading.approved || loading.rejected">
        <span v-if="loading.rejected" class="spinner-border spinner-border-sm"></span>
        {{ $t('labels.reject') }}
      </button>
      <button type="button" class="btn btn-light" v-on:click="$emit('cancel')">
        {{ $t('labels.cancel') }}
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { TravelSimple } from '@/../../common/types.js'
import TravelApply from '@/components/travel/elements/TravelApplication.vue'
import { defineComponent, PropType } from 'vue'
export default defineComponent({
  name: 'TravelApproveForm',
  data() {
    return {
      comment: '',
      loading: {
        approved: false,
        rejected: false
      }
    }
  },
  components: { TravelApply },
  props: { travel: { type: Object as PropType<TravelSimple>, required: true } },
  emits: ['decision', 'cancel'],
  methods: {
    clear() {
      this.comment = ''
      this.loading = {
        approved: false,
        rejected: false
      }
    },
    output(decision: 'approved' | 'rejected') {
      this.loading[decision] = true
      this.$emit('decision', decision, this.comment)
    }
  }
})
</script>

<style></style>
