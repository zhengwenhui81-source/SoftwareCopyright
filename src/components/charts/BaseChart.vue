<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  option: { type: Object, required: true },
  height: { type: String, default: '300px' },
  theme: { type: String, default: undefined },
})
const emit = defineEmits(['chart-click'])

const chartRef = ref()
let chartInstance
let resizeObserver

function renderChart() {
  if (!chartInstance || !props.option) return
  chartInstance.setOption(props.option, { notMerge: true, lazyUpdate: true })
}

onMounted(async () => {
  await nextTick()
  chartInstance = echarts.init(chartRef.value, props.theme)
  chartInstance.on('click', (params) => emit('chart-click', params))
  renderChart()
  resizeObserver = new ResizeObserver(() => chartInstance?.resize())
  resizeObserver.observe(chartRef.value)
})

watch(() => props.option, renderChart, { deep: true })

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  chartInstance?.dispose()
  chartInstance = null
})
</script>

<template><div ref="chartRef" class="base-chart" :style="{ height }"></div></template>

<style scoped>
.base-chart { width: 100%; min-width: 0; }
</style>
