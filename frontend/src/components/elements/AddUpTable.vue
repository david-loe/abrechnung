<template>
  <table class="table align-bottom">
    <tbody>
      <tr v-if="progress !== undefined">
        <th>{{ t('labels.progress') }}</th>
        <td class="text-end">
          <ProgressCircle :progress="progress"></ProgressCircle>
        </td>
      </tr>
      <tr v-if="(addUp as AddUpResult<Travel>).lumpSums">
        <td>
          <small>
            {{ t('labels.lumpSums') }}
            <small v-if="claimSpouseRefund">
              <br />
              {{ t('labels.includingSpouseRefund') }}
            </small>
          </small>
        </td>
        <td class="text-end align-top">
          <small>{{ $formatter.money((addUp as AddUpResult<Travel>).lumpSums) }}</small>
        </td>
      </tr>
      <tr>
        <td>
          <small>{{ t('labels.expenses') }}</small>
        </td>
        <td class="text-end">
          <small>{{ $formatter.money(addUp.expenses) }}</small>
        </td>
      </tr>
      <tr v-if="addUp.advance.amount">
        <td class="text-secondary">
          <small>{{ t('labels.advance') }}</small>
        </td>
        <td class="text-end text-secondary">
          <small v-if="addUp.advanceOverflow">{{ $formatter.money(addUp.total , { func: (x) => 0 - x }) }}
          <small v-if="showAdvanceOverflow"><br/>  {{ `(${$formatter.money({amount: addUp.advance.amount - (addUp.total.amount || 0)})} ${t('labels.left')})` }}
          </small></small>
          <small v-else>{{ $formatter.money(addUp.advance, { func: (x) => 0 - x }) }}
        </small>
        </td>
      </tr>
      <tr>
        <th>{{ t('labels.balance') }}</th>
        <td class="text-end">{{ $formatter.money(addUp.balance) }}</td>
      </tr>
      <tr v-if="refundSum">
        <th>{{ t('labels.refundSum') }}</th>
        <td class="text-end">{{ $formatter.money(refundSum) }}</td>
      </tr>
      <tr v-if="project.budget && project.budget.amount">
        <td>
          <small>{{ t('labels.project') }}</small>
        </td>
        <td class="text-end">
          <small>{{ $formatter.money(project.balance) + ' von ' + $formatter.money(project.budget) }}</small>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import { AddUpResult, Money, Project, Travel } from '@/../../common/types.js'
import ProgressCircle from '@/components/elements/ProgressCircle.vue'
import { PropType } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  addUp: { type: Object as PropType<AddUpResult>, required: true },
  claimSpouseRefund: { type: Boolean as PropType<boolean | null | undefined>, default: false },
  progress: { type: Number },
  project: { type: Object as PropType<Project>, required: true },
  refundSum: { type: Object as PropType<Money> },
  showAdvanceOverflow: { type: Boolean, default: true }
})
</script>
