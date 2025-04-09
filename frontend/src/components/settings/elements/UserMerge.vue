<template>
  <form @submit.prevent="mergeUser()">
    <div class="row align-items-center">
      <div class="col">
        <label>{{ $t('labels.user') }}</label>
        <UserSelector v-model="userId" required></UserSelector>
      </div>
      <div class="col-auto">
        <i class="bi bi-chevron-double-right fs-2"></i>
      </div>
      <div class="col">
        <label>{{ $t('labels.userToOverwrite') }}</label>
        <UserSelector @update:model-value="(_id) => (userIdToOverwrite = _id)"></UserSelector>
        <input
          class="form-control form-control-sm"
          type="text"
          v-model="userIdToOverwrite"
          placeholder="User ID"
          :pattern="objectIdRegex.source"
          required />
        <div class="form-check mt-2">
          <input class="form-check-input" type="checkbox" v-model="delOverwritten" id="delOverwritten" />

          <label class="form-check-label" for="delOverwritten"
            ><i class="bi bi-trash me-1 text-danger"></i>{{ $t('labels.delOverwritten') }}</label
          >
        </div>
      </div>
    </div>

    <div v-if="result" class="alert alert-info d-flex px-2 py-1 mt-1" role="alert">
      <i class="bi bi-info-circle-fill"></i>
      <span class="ms-3">
        <span v-for="(obj, collection) of result.replacedReferences" class="me-4">
          <strong class="me-1">{{ collection }}:</strong>
          <span class="me-3"><i class="bi bi-search"></i> {{ obj?.matchedCount }}</span>
          <span><i class="bi bi-pencil"></i> {{ obj?.modifiedCount }}</span>
        </span>
        <br />
        <span v-if="result.deleteResult && result.deleteResult.deletedCount === 1">
          <i class="bi bi-person-x fs-4"></i>
          {{ $t('alerts.successDeleting') }}
        </span>
        <br />
        <strong>
          <a href="/settings"><i class="bi bi-arrow-clockwise me-1"></i>{{ $t('alerts.reloadRequired') }}</a>
        </strong>
      </span>
      <button type="button" class="btn-close ms-auto" @click="result = undefined"></button>
    </div>
    <button role="submit" class="btn btn-secondary">{{ $t('labels.mergeUsers') }}</button>
  </form>
</template>

<script lang="ts">
import { User, UserReplaceReferencesResult, objectIdRegex } from '@/../../common/types.js'
import API from '@/api.js'
import UserSelector from '@/components/elements/UserSelector.vue'
import { defineComponent } from 'vue'

type MergeResult = {
  mergedUser: User
  replacedReferences: UserReplaceReferencesResult
  deleteResult: {
    acknowledged: boolean
    deletedCount: number
  } | null
}

export default defineComponent({
  name: 'UserMerge',
  components: { UserSelector },
  data() {
    return {
      userId: null as string | null,
      userIdToOverwrite: null as string | null,
      delOverwritten: false,
      result: undefined as MergeResult | undefined,
      objectIdRegex
    }
  },
  methods: {
    async mergeUser() {
      if (confirm(this.$t('alerts.areYouSureMerge'))) {
        const result = await API.setter<MergeResult>(
          'admin/user/merge',
          { userId: this.userId, userIdToOverwrite: this.userIdToOverwrite },
          { params: { delOverwritten: this.delOverwritten } }
        )
        if (result.ok) {
          this.result = result.ok
        }
      }
    }
  }
})
</script>

<style></style>
