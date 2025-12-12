<template>
  <form @submit.prevent="search">
    <div class="position-relative">
      <div v-if="loadingSearch" class="z-1 position-absolute top-50 end-0 translate-middle-y">
        <span class="spinner-border spinner-border-sm me-2"></span>
      </div>
      <input type="text" class="form-control" placeholder="Ref" v-model="searchInput" >
    </div>
  </form>
</template>

<script lang="ts" setup>
import { idDocumentToId, refStringRegexLax, User } from 'abrechnung-common/types.js'
import { refStringToNumber } from 'abrechnung-common/utils/scripts.js'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import API from '@/api.js'
import UserSelector from '@/components/elements/UserSelector.vue'

const { t } = useI18n()

const searchInput = ref('')
const loadingSearch = ref(false)

async function updateReport() {
  if (confirm(t('alerts.areYouSureToUpdate'))) {
    await API.setter('admin/tools/report', {})
  }
}

async function search() {
  const term = searchInput.value.trim()
  if (term) {
    loadingSearch.value = true
    if (refStringRegexLax.exec(term)) {
      const params = refStringToNumber(term)
      const result = await API.getter('search/ref', params)
      if (result.ok) {
        searchInput.value = ''
      }
    }
    loadingSearch.value = false
  }
}
</script>

<style></style>
