<template>
  <table :class="`${noBootstrapTable ? '' : 'table '}align-bottom`">
    <tbody>
      <tr v-if="progress !== undefined">
        <th>{{ t('labels.progress') }}</th>
        <td class="text-end">
          <ProgressCircle :progress="progress" />
        </td>
      </tr>
      <tr v-for="row of addUpTableData">
        <th class="align-top">
          {{ t(row[0]) }}
          <small class="fw-normal" v-if="row[0] === 'labels.lumpSums' && claimSpouseRefund">
            <br >
            {{ t('labels.includingSpouseRefund') }}
          </small>
        </th>
        <template v-for="(col, index) of row">
          <td v-if="index !== 0" class="text-end tnum">
            {{ col }}
            <small v-if="row[0] === 'labels.advance' && showAdvanceOverflow && addUp[index - 1].advanceOverflow">
              <br >
              {{ `(${formatAddUpAmount(getAdvanceOverflowAmount(addUp[index - 1]), addUp[index - 1])} ${t('labels.left')})` }}
            </small>
            <template v-if="row[0] === 'labels.balance' && addUp[index - 1].negativeTotal">
              <TooltipElement :text="t('alerts.negativeTotal')"><small class="fw-light">
                <br >
                {{ `(⚠️ ${formatAddUpAmount(getNegativeTotalWarningAmount(addUp[index - 1]), addUp[index - 1])})` }}
              </small></TooltipElement>
            </template>
          </td>
        </template>
      </tr>
      <tr v-if="addUp.length > 1">
        <th>{{ t('labels.totalBalance') }}</th>
        <td :colspan="addUp.length" class="text-end tnum">{{ totalBalance }}</td>
      </tr>
      <tr v-if="exchangeRateDate">
        <th>{{ t('labels.exchangeRate') }}</th>
        <td :colspan="addUp.length" class="text-end tnum">
          <span v-if="typeof exchangeRate === 'number'">
            {{ `1 ${addUp[0]?.currency._id} = ${formatter.float(exchangeRate)} ${baseCurrency._id}` }}
          </span>
          <span v-else>⚠️ {{ t('alerts.exchangeRateUnavailable') }}</span>
          <template v-if="showExchangeRateDate">
            <br >
            <small class="text-secondary">{{ formatter.date(exchangeRateDate) }}</small>
          </template>
        </td>
      </tr>
      <tr v-if="project.budget && project.budget.amount">
        <td><small>{{ t('labels.project') }}</small></td>
        <td class="text-end">
          <small>{{ formatter.money(project.balance) + ' ' + t('labels.from') + ' ' + formatter.money(project.budget) }}</small>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import { AddUp, baseCurrency, FlatAddUp, idDocumentToId, Project, Travel } from 'abrechnung-common/types.js'
import { getAddUpTableData, getTotalBalance, multiplyAmountAndRound, subtractAmounts, sumAmounts } from 'abrechnung-common/utils/scripts.js'
import { computed, PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatter } from '../../formatter.js'
import ProgressCircle from './ProgressCircle.vue'
import TooltipElement from './TooltipElement.vue'

const { t } = useI18n()

const props = defineProps({
  noBootstrapTable: { type: Boolean, default: false },
  addUp: { type: Array as PropType<AddUp<string>[]>, required: true },
  claimSpouseRefund: { type: Boolean as PropType<boolean | null | undefined>, default: false },
  progress: { type: Number },
  project: { type: Object as PropType<Project>, required: true },
  exchangeRate: { type: Number as PropType<number | null> },
  exchangeRateDate: { type: [String, Date] as PropType<Date | string | null> },
  showExchangeRateDate: { type: Boolean, default: true },
  showAdvanceOverflow: { type: Boolean, default: true },
  withLumpSums: { type: Boolean, default: false }
})

const addUpTableData = computed(() => getAddUpTableData(formatter, props.addUp, props.withLumpSums, props.exchangeRate))
const totalBalance = computed(() => {
  const amount = getTotalBalance(props.addUp)
  return typeof props.exchangeRate === 'number'
    ? formatter.baseCurrency(multiplyAmountAndRound(amount, props.exchangeRate))
    : formatter.currency(amount, idDocumentToId(props.addUp[0]?.currency ?? baseCurrency))
})

function formatAddUpAmount(amount: number, addUp: AddUp<string>) {
  return formatter.currency(amount, idDocumentToId(addUp.currency))
}

function getAdvanceOverflowAmount(addUp: AddUp<string>) {
  return subtractAmounts(addUp.advance.amount, addUp.total.amount)
}

function getNegativeTotalWarningAmount(addUp: AddUp<string>) {
  return sumAmounts(addUp.expenses.amount, (addUp as FlatAddUp<string, Travel<string>>).lumpSums?.amount || 0)
}
</script>
