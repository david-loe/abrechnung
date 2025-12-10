<template>
  <div class="row gy-3">
    <div class="col">
      <h4>{{ t('labels.reportUsage') }}</h4>
      <small class="chart-card__meta"> {{t('labels.lastXMonths', {X:COUNT_MONTH})}}</small>

      <div class="chart-wrapper">
        <canvas ref="reportUsageCanvas" />
      </div>
    </div>
    <div class="col">
      <h4>{{ t('labels.dbUsage') }}</h4>
      <small class="chart-card__meta">{{ t('labels.threshold') + ': ' + formatBytes(thresholdBytes) }}</small>

      <div class="chart-wrapper">
        <canvas ref="dbTotalSizeCanvas" />
      </div>
    </div>
    <div class="col">
      <h4>{{ t('labels.fsUsage') }}</h4>
      <small class="chart-card__meta">{{ t('labels.total') + ': ' + formatBytes(dbUsage?.fsTotalSize ?? 0) }}</small>

      <div class="chart-wrapper">
        <canvas ref="dbUsageCanvas" />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ReportModelName, reportModelNames } from 'abrechnung-common/types.js'
import { formatBytes } from 'abrechnung-common/utils/file.js'
import type { Plugin } from 'chart.js'
import Chart from 'chart.js/auto'
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue'

import { useI18n } from 'vue-i18n'
import API from '@/api.js'

declare module 'chart.js' {
  interface PluginOptionsByType<TType> {
    thresholdLine?: { value?: number; color?: string }
  }
}

const { t, locale } = useI18n()

const COUNT_MONTH = 4
const thresholdBytes = 1_000_000_000 // 1 GB

const dbUsage = (await API.getter<{ totalSize: number; scale: number; fsUsedSize: number; fsTotalSize: number }>('stats/dbUsage')).ok?.data
const bodyFont = getComputedStyle(document.body).fontFamily || 'inherit'
Chart.defaults.font.family = bodyFont
Chart.defaults.devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2)

const NOW = new Date()
const monthFormatter = new Intl.DateTimeFormat(locale.value, { month: 'short' })
const reportUsage: Array<{ label: string; usage: { [key in ReportModelName]: number } }> = []

for (let m = COUNT_MONTH - 1; m >= 0; m--) {
  const from = new Date(Date.UTC(NOW.getFullYear(), NOW.getMonth() - m, 1))
  const to = new Date(Date.UTC(NOW.getFullYear(), NOW.getMonth() + 1 - m, 0))
  const usageResponse = await API.getter<{ reportUsage: { [key in ReportModelName]: number }; from: string; to: string }>(
    'stats/reportUsage',
    { from, to }
  )
  if (usageResponse.ok?.data) {
    reportUsage.push({ label: monthFormatter.format(from), usage: usageResponse.ok.data.reportUsage })
  }
}

const reportUsageCanvas = useTemplateRef('reportUsageCanvas')
const dbUsageCanvas = useTemplateRef('dbUsageCanvas')
const dbTotalSizeCanvas = useTemplateRef('dbTotalSizeCanvas')

let reportChart: Chart | null = null
let dbChart: Chart | null = null
let dbTotalChart: Chart | null = null
const thresholdLinePlugin = {
  id: 'thresholdLine',
  afterDraw(chart: Chart, _args: unknown, opts: { value?: number; color?: string }) {
    const value = opts?.value
    if (value == null) return
    const yScale = chart.scales.y
    const chartArea = chart.chartArea
    if (!yScale || !chartArea) return
    const y = yScale.getPixelForValue(value)
    const ctx = chart.ctx
    ctx.save()
    ctx.strokeStyle = opts.color || '#dc3545'
    ctx.setLineDash([6, 4])
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(chartArea.left, y)
    ctx.lineTo(chartArea.right, y)
    ctx.stroke()
    ctx.restore()
  }
}

const stackedTotalLabelsPlugin = (formatter?: (total: number) => string) =>
  ({
    id: 'stackedTotalLabels',
    afterDatasetsDraw(chart) {
      const { data, ctx, scales } = chart
      const yScale = scales.y
      if (!yScale || !data.labels?.length) return
      const font = Chart.defaults.font || {}
      const fontString = `${font.weight ? `${font.weight} ` : ''}${font.size ?? 12}px ${font.family ?? 'sans-serif'}`
      ctx.save()
      ctx.font = fontString
      ctx.fillStyle = textColor || '#000'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'

      data.labels.forEach((_label, dataIndex) => {
        let total = 0
        let hasValue = false
        let xPos: number | null = null
        data.datasets.forEach((dataset, datasetIndex) => {
          if (!chart.isDatasetVisible(datasetIndex) || !Array.isArray(dataset.data)) return
          const raw = dataset.data[dataIndex]
          const value = typeof raw === 'number' ? raw : Number(raw)
          if (!Number.isFinite(value)) return
          total += value
          hasValue = true
          if (xPos == null) {
            const element = chart.getDatasetMeta(datasetIndex)?.data?.[dataIndex] as { x: number } | undefined
            xPos = element?.x ?? null
          }
        })
        if (!hasValue || xPos == null) return
        const y = yScale.getPixelForValue(total)
        ctx.fillText(`${formatter ? formatter(total) : total}`, xPos, y - 6)
      })
      ctx.restore()
    }
  }) as Plugin<'bar'>

const reportLabels: Record<ReportModelName, string> = {
  Advance: t('labels.advance'),
  ExpenseReport: t('labels.expenseReport'),
  HealthCareCost: t('labels.healthCareCost'),
  Travel: t('labels.travel')
}

const reportColors: Record<ReportModelName, string> = { Advance: '', ExpenseReport: '', HealthCareCost: '', Travel: '' }
const chartBorderColors: Record<ReportModelName, string> = { Advance: '', ExpenseReport: '', HealthCareCost: '', Travel: '' }

onMounted(() => {
  applyPalette()
  createReportUsageChart()
  createDbUsageChart()
  createDbTotalSizeChart()
})

onBeforeUnmount(() => {
  reportChart?.destroy()
  dbChart?.destroy()
  dbTotalChart?.destroy()
})

function createReportUsageChart() {
  if (!reportUsageCanvas.value || !reportUsage.length) {
    return
  }

  reportChart?.destroy()
  const labels = reportUsage.map((entry) => entry.label)

  reportChart = new Chart(reportUsageCanvas.value, {
    type: 'bar',
    data: {
      labels,
      datasets: reportModelNames.map((type) => ({
        label: reportLabels[type],
        data: reportUsage.map((entry) => entry.usage[type] ?? 0),
        backgroundColor: reportColors[type],
        borderColor: chartBorderColors[type],
        borderWidth: 0.5,
        borderRadius: 2,
        maxBarThickness: 35
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, color: textColor } },
        tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${context.parsed.y ?? 0}` } }
      },
      interaction: { intersect: false },
      animation: { duration: 600 },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: textColor } },
        y: { stacked: true, beginAtZero: true, ticks: { precision: 0, color: textColor }, grid: { color: gridColor } }
      },
      elements: { bar: { borderSkipped: false } }
    },
    plugins: [stackedTotalLabelsPlugin()]
  })
}

function translateOrFallback(key: string, fallback: string) {
  const translated = t(key)
  return translated === key ? fallback : translated
}

function getCssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

const doughnutColors = { filled: '', filledBorder: '', empty: '', emptyBorder: '' }
const totalSizeColors = { total: '', totalBorder: '', threshold: '', thresholdBorder: '' }
let gridColor = ''
let textColor = ''

function applyPalette() {
  const primary = getCssVar('--bs-primary')
  const primaryBorder = getCssVar('--bs-primary-border-subtle') || primary
  const warning = getCssVar('--bs-warning')
  const warningBorder = getCssVar('--bs-warning-border-subtle') || warning
  const success = getCssVar('--bs-success')
  const successBorder = getCssVar('--bs-success-border-subtle') || success
  const purple = getCssVar('--bs-purple') || getCssVar('--bs-secondary')
  const purpleBorder = getCssVar('--bs-purple-border-subtle') || purple
  const info = getCssVar('--bs-info') || primary
  const mutedBg = getCssVar('--bs-secondary-bg') || '#f1f3f5'
  const border = getCssVar('--bs-border-color') || '#ced4da'
  gridColor = getCssVar('--bs-border-color-translucent') || 'rgba(0,0,0,0.08)'
  textColor = getCssVar('--bs-body-color') || '#212529'

  reportColors.Advance = purple
  chartBorderColors.Advance = purpleBorder
  reportColors.ExpenseReport = primary
  chartBorderColors.ExpenseReport = primaryBorder
  reportColors.HealthCareCost = success
  chartBorderColors.HealthCareCost = successBorder
  reportColors.Travel = warning
  chartBorderColors.Travel = warningBorder

  doughnutColors.filled = primary
  doughnutColors.filledBorder = primaryBorder
  doughnutColors.empty = mutedBg
  doughnutColors.emptyBorder = border

  totalSizeColors.total = info
  totalSizeColors.totalBorder = getCssVar('--bs-info-border-subtle') || info
  totalSizeColors.threshold = warning
  totalSizeColors.thresholdBorder = warningBorder
}

function createDbUsageChart() {
  if (!dbUsageCanvas.value || !dbUsage) {
    return
  }

  dbChart?.destroy()
  const used = dbUsage.fsUsedSize
  const free = Math.max(dbUsage.fsTotalSize - dbUsage.fsUsedSize, 0)

  dbChart = new Chart(dbUsageCanvas.value, {
    type: 'doughnut',
    data: {
      labels: [translateOrFallback('labels.used', 'Used'), translateOrFallback('labels.free', 'Free')],
      datasets: [
        {
          data: [used, free],
          backgroundColor: [doughnutColors.filled, doughnutColors.empty],
          borderColor: [doughnutColors.filledBorder, doughnutColors.emptyBorder],
          borderWidth: 1.5,
          hoverOffset: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, color: textColor } },
        tooltip: { callbacks: { label: (context) => `${context.label}: ${formatBytes(Number(context.raw))}` } }
      },
      cutout: '68%',
      animation: { duration: 500 }
    }
  })
}

function createDbTotalSizeChart() {
  if (!dbTotalSizeCanvas.value || !dbUsage) {
    return
  }

  dbTotalChart?.destroy()
  const totalBytes = dbUsage.totalSize * dbUsage.scale
  const tickStep = thresholdBytes / 4
  const maxValue = Math.max(totalBytes, thresholdBytes, 1)
  const yMax = Math.ceil(maxValue / tickStep) * tickStep + tickStep
  const stepSize = (Math.ceil(maxValue / tickStep) * tickStep) / 4
  const totalLabel = translateOrFallback('labels.dbTotalSize', 'Total Size')

  dbTotalChart = new Chart(dbTotalSizeCanvas.value, {
    type: 'bar',
    data: {
      labels: [totalLabel],
      datasets: [
        {
          label: totalLabel,
          data: [totalBytes],
          backgroundColor: totalSizeColors.total,
          borderColor: totalSizeColors.totalBorder,
          borderWidth: 1.5,
          borderRadius: 12,
          maxBarThickness: 32
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        thresholdLine: { value: thresholdBytes, color: totalSizeColors.threshold }
      },
      interaction: { intersect: false },
      animation: { duration: 600 },
      scales: {
        y: {
          beginAtZero: true,
          max: yMax,
          ticks: { callback: (value) => formatBytes(Number(value)), color: textColor, stepSize: stepSize },
          grid: { color: gridColor }
        },
        x: { stacked: false, grid: { display: false }, ticks: { color: textColor } }
      },
      elements: { bar: { borderSkipped: false } }
    },
    plugins: [thresholdLinePlugin, stackedTotalLabelsPlugin(formatBytes)]
  })
}
</script>

<style scoped>
.chart-wrapper {
  height: 300px;
  max-width: 300px;
}

.chart-card__meta {
  color: var(--bs-secondary-color);
}

.chart-wrapper canvas {
  width: 100%;
  height: 100%;
  image-rendering: optimizeQuality;
}
</style>
