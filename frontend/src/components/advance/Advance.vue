<template>
  <StatePipeline class="mb-4" :state="advance.state" :StateEnum="AdvanceState" />
  <table class="table mb-2">
    <tbody>
      <tr>
        <th scope="row">{{ t('labels.owner') }}</th>
        <td>{{ `${formatter.name(advance.owner.name)}` }}</td>
      </tr>
      <tr>
        <th scope="row">{{ t('labels.reason') }}</th>
        <td>{{ advance.reason }}</td>
      </tr>
      <tr>
        <th scope="row">{{ t('labels.budget') }}</th>
        <td>
          <span> {{ formatter.money(advance.budget) }}</span>
          <span v-if="advance.budget.exchangeRate" class="text-secondary">
            &nbsp;-&nbsp;
            {{ formatter.money(advance.budget, { useExchangeRate: false }) }}
          </span>
        </td>
      </tr>
      <tr v-if="advance.offsetAgainst.length > 0">
        <th scope="row">{{ t('labels.offsetAgainst') }}</th>
        <td>
          <div class="mb-1" v-for="report in advance.offsetAgainst">
            <small>
              <span class="me-2">{{ formatter.money(report) }}</span>
              <i
                v-if="APP_DATA"
                :class="`bi bi-${APP_DATA.displaySettings.reportTypeIcons[getReportTypeFromModelName(report.type)]} me-1`"></i>
              <span v-if="report.report">{{ report.report.name }}</span>
            </small>
          </div>
        </td>
      </tr>
      <tr v-if="advance.state >= AdvanceState.APPROVED">
        <th scope="row">{{ t('labels.balance') }}</th>
        <td>
          <span> {{ formatter.money(advance.balance) }}</span>
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
              <b>{{ `${formatter.name(comment.author.name, 'short')}: ` }}</b>
              <span>{{ comment.text }}</span>
            </small>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
  <button
    v-if="advance.state >= State.BOOKABLE"
    class="btn btn-primary mb-2"
    @click="
      showFile({
        endpoint: `${props.endpointPrefix}advance/report`,
        params: { _id: advance._id },
        filename: `${advance.name}.pdf`,
        isDownloading: isDownloadingFn()
      })
    "
    :title="t('labels.report')"
    :disabled="Boolean(isDownloading)">
    <span v-if="isDownloading" class="spinner-border spinner-border-sm"></span>
    <i v-else class="bi bi-file-earmark-pdf"></i>
    <span class="ms-1">{{ t('labels.showX', { X: t('labels.report') }) }}</span>
  </button>
</template>
<script setup lang="ts">
import { AdvanceSimple, AdvanceState, getReportTypeFromModelName, State } from 'abrechnung-common/types.js'
import { PropType, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import StatePipeline from '@/components/elements/StatePipeline.vue'
import APP_LOADER from '@/dataLoader.js'
import { formatter } from '@/formatter.js'
import { showFile } from '@/helper.js'

const { t } = useI18n()

const props = defineProps({
  advance: { type: Object as PropType<AdvanceSimple<string>>, required: true },
  endpointPrefix: { type: String, default: '' }
})

const isDownloading = ref('')
const isDownloadingFn = () => isDownloading

await APP_LOADER.loadData()
const APP_DATA = APP_LOADER.data
</script>
