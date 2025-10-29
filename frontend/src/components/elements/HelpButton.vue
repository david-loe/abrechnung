<template>
  <div v-if="APP_DATA?.displaySettings.helpButton.enabled && hasAny" class="dropdown">
    <button type="button" class="btn btn-outline-info" data-bs-toggle="dropdown" aria-expanded="false">{{ t('labels.help') }}</button>
    <ul class="dropdown-menu dropdown-menu-end">
      <li v-if="APP_DATA?.displaySettings.helpButton.examinersMail && examinerMails.length > 0">
        <a class="dropdown-item" :href="mailToLinkVal"
          ><i class="bi bi-envelope-fill me-1"></i>Mail</a
        >
      </li>
      <li v-if="APP_DATA?.displaySettings.helpButton.examinersMsTeams && examinerMails.length > 0">
        <a class="dropdown-item" :href="msTeamsToLinkVal" target="_blank"
          ><i class="bi bi-microsoft-teams me-1"></i>Teams</a
        >
      </li>
      <li v-for="entry of APP_DATA?.displaySettings.helpButton.customOptions">
        <a class="dropdown-item" :href="entry.link" target="_blank"
          ><i :class="`bi bi-${entry.icon} me-1`"></i>
          {{ entry.label }}</a
        >
      </li>
    </ul>
  </div>
</template>

<script lang="ts" setup>
import { mailToLink, msTeamsToLink } from 'abrechnung-common/utils/scripts.js'
import { useI18n } from 'vue-i18n'
import APP_LOADER from '@/dataLoader.js'

const { t } = useI18n()

const props = defineProps<{ examinerMails: string[] }>()

const mailToLinkVal = mailToLink(props.examinerMails)
const msTeamsToLinkVal = msTeamsToLink(props.examinerMails)

await APP_LOADER.loadData()
const APP_DATA = APP_LOADER.data

const hasAny =
  ((APP_DATA.value?.displaySettings.helpButton.examinersMsTeams || APP_DATA.value?.displaySettings.helpButton.examinersMail) &&
    props.examinerMails.length > 0) ||
  (APP_DATA.value?.displaySettings.helpButton.customOptions && APP_DATA.value?.displaySettings.helpButton.customOptions.length > 0)
</script>
