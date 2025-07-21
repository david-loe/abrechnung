<template>
  <select
    v-if="APP_DATA"
    :class="'form-select' + (APP_DATA.organisations.length > 1 ? '' : ' d-none')"
    id="healthCareCostFormProject"
    v-model="selectedOrg"
    :disabled="disabled"
    :required="required"
    @change="changeOrganisation">
    <option v-for="organisation in APP_DATA.organisations" :value="organisation" :key="organisation._id">
      {{ organisation.name }}
    </option>
  </select>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { OrganisationSimple } from '@/../../common/types.js'
import API from '@/api.js'
import APP_LOADER from '@/appData.js'

const props = defineProps<{ modelValue: OrganisationSimple | null; required?: boolean; disabled?: boolean; updateUserOrg?: boolean }>()

const selectedOrg = ref(props.modelValue)

const emit = defineEmits<{ 'update:modelValue': [OrganisationSimple] }>()

await APP_LOADER.loadData()
const APP_DATA = APP_LOADER.data

async function changeOrganisation() {
  if (selectedOrg.value) {
    emit('update:modelValue', selectedOrg.value)
    if (props.updateUserOrg && APP_DATA.value) {
      APP_DATA.value.user.settings.organisation = selectedOrg.value
      await API.setter('user/settings', { organisation: selectedOrg.value._id }, {}, false)
    }
  }
}
</script>

<style></style>
