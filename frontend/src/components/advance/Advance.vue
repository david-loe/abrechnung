<template>
  <StatePipeline class="mb-4" :state="advance.state" :states="advanceStates"></StatePipeline>
  <table class="table mb-4">
    <tbody>
      <tr>
        <th scope="row">{{ t('labels.owner') }}</th>
        <td>{{ `${advance.owner.name.givenName} ${advance.owner.name.familyName}` }}</td>
      </tr>
      <tr>
        <th scope="row">{{ t('labels.reason') }}</th>
        <td>{{ advance.reason }}</td>
      </tr>
      <tr>
        <th scope="row">{{ t('labels.budget') }}</th>
        <td>
          <span>
            {{ $formatter.money(advance.budget) }}
          </span>
          <span v-if="advance.budget.exchangeRate" class="text-secondary">
            &nbsp;-&nbsp;
            {{ $formatter.money(advance.budget, { useExchangeRate: false }) }}
          </span>
        </td>
      </tr>
      <tr v-if="advance.offsetAgainst.length > 0">
        <th scope="row">{{ t('labels.offsetAgainst') }}</th>
        <td>
          <div class="mb-1" v-for="report in advance.offsetAgainst">
            <small>
              <span class="me-2">{{ $formatter.money(report) }}</span>
              <i
                v-if="APP_DATA"
                :class="`bi bi-${APP_DATA.displaySettings.reportTypeIcons[getReportTypeFromModelName(report.type)]} me-1`"></i>
              <span v-if="report.report">{{ report.report.name }}</span>
              <i class="text-secondary" v-else>{{ t('labels.deleted') }}</i>
            </small>
          </div>
        </td>
      </tr>
      <tr v-if="advance.state === 'approved' || advance.state === 'completed'">
        <th scope="row">{{ t('labels.balance') }}</th>
        <td>
          <span>
            {{ $formatter.money(advance.balance) }}
          </span>
        </td>
      </tr>
      <tr>
        <th scope="row">{{ t('labels.project') }}</th>
        <td>{{ `${advance.project.identifier} ${advance.project.name}` }}</td>
      </tr>
      <tr v-if="advance.comments.length > 0">
        <th scope="row">{{ t('labels.comments') }}</th>
        <td>
          <div class="mb-1" v-for="comment in advance.comments" :key="comment._id">
            <small>
              <b>{{ `${comment.author.name.givenName} ${comment.author.name.familyName.substring(0, 1)}: ` }}</b>
              <span>{{ comment.text }}</span>
            </small>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
  <a
    v-if="advance.state === 'completed' || advance.state === 'approved'"
    class="btn btn-primary"
    :href="advanceReportLink(advance._id)"
    :download="advance.name + '.pdf'">
    <i class="bi bi-download"></i>
    <span class="ms-1">{{ t('labels.downloadX', { X: t('labels.report') }) }}</span>
  </a>
</template>
<script setup lang="ts">
import { AdvanceSimple, advanceStates, getReportTypeFromModelName } from '@/../../common/types'
import APP_LOADER from '@/appData.js'
import StatePipeline from '@/components/elements/StatePipeline.vue'
import { PropType } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  advance: {
    type: Object as PropType<AdvanceSimple>,
    required: true
  }
})

await APP_LOADER.loadData()
const APP_DATA = APP_LOADER.data

const advanceReportLink = (id: string) => `${import.meta.env.VITE_BACKEND_URL}/advance/report?_id=${id}`
</script>
