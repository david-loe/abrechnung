<template>
  <form @submit.prevent="mergeUser()">
    <div class="row align-items-center">
      <div class="col">
        <label>{{ t('labels.user') }}</label>
        <UserSelector v-model="user" required />
      </div>
      <div class="col-auto">
        <i class="bi bi-chevron-double-right fs-2"></i>
      </div>
      <div class="col">
        <label>{{ t('labels.userToOverwrite') }}</label>
        <UserSelector @update:model-value="(u) => (userIdToOverwrite = idDocumentToId(u))" />
        <input
          class="form-control form-control-sm"
          type="text"
          v-model="userIdToOverwrite"
          placeholder="User ID"
          :pattern="objectIdRegex.source"
          required >
        <div class="form-check mt-2">
          <input class="form-check-input" type="checkbox" v-model="delOverwritten" id="delOverwritten" >

          <label class="form-check-label" for="delOverwritten">
            <i class="bi bi-trash me-1 text-danger"></i>
            {{ t('labels.delOverwritten') }}
          </label>
        </div>
      </div>
    </div>

    <div v-if="mergeResult" class="alert alert-info d-flex px-2 py-1 mt-1" role="alert">
      <i class="bi bi-info-circle-fill"></i>
      <span class="ms-3">
        <span v-for="(obj, collection) of mergeResult.replacedReferences" class="me-4">
          <strong class="me-1">{{ collection }}:</strong>
          <span class="me-3"
            ><i class="bi bi-search"></i>
            {{ obj?.matchedCount }}</span
          >
          <span
            ><i class="bi bi-pencil"></i>
            {{ obj?.modifiedCount }}</span
          >
        </span>
        <br >
        <span v-if="mergeResult.deleteResult && mergeResult.deleteResult.deletedCount === 1">
          <i class="bi bi-person-x fs-4"></i>
          {{ t('alerts.successDeleting') }}
        </span>
        <br >
        <strong>
          <a href="/admin"
            ><i class="bi bi-arrow-clockwise me-1"></i>
            {{ t('alerts.reloadRequired') }}</a
          >
        </strong>
      </span>
      <button type="button" class="btn-close ms-auto" @click="mergeResult = null"></button>
    </div>
    <button role="submit" class="btn btn-secondary">{{ t('labels.mergeUsers') }}</button>
  </form>
</template>

<script lang="ts" setup>
import { idDocumentToId, objectIdRegex, User, UserReplaceReferencesResult, UserSimpleWithProject } from 'abrechnung-common/types.js'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import API from '@/api.js'
import UserSelector from '@/components/elements/UserSelector.vue'

const { t } = useI18n()

type MergeResult = {
  mergedUser: User
  replacedReferences: UserReplaceReferencesResult
  deleteResult: { acknowledged: boolean; deletedCount: number } | null
}

const user = ref(null as UserSimpleWithProject<string> | null)
const userIdToOverwrite = ref(null as string | null)
const delOverwritten = ref(false)
const mergeResult = ref(null as MergeResult | null)

async function mergeUser() {
  if (confirm(t('alerts.areYouSureMerge'))) {
    const result = await API.setter<MergeResult>(
      'admin/user/merge',
      { userId: idDocumentToId(user.value), userIdToOverwrite: userIdToOverwrite.value },
      { params: { delOverwritten: delOverwritten.value } }
    )
    if (result.ok) {
      mergeResult.value = result.ok
    }
  }
}
</script>

<style></style>
