<script setup>
import { computed, ref, watch } from 'vue'
import BaseChart from '@/components/charts/BaseChart.vue'
import { getParameterTrend } from '@/processParameter'

const props = defineProps({ batchId: { type: String, required: true }, process: { type: String, required: true }, parameters: { type: Array, required: true } })
const selectedKey = ref(props.parameters[0]?.key || '')
watch(() => [props.process, props.parameters], () => { selectedKey.value = props.parameters[0]?.key || '' }, { deep: true })
const trend = computed(() => getParameterTrend(props.batchId, props.process, selectedKey.value))
const selectedStatus = computed(() => props.parameters.find((item) => item.key === selectedKey.value))
const chartOption = computed(() => {
  const data = trend.value
  const abnormal = selectedStatus.value?.level !== 'normal'
  const text = { color: '#7896ac', fontSize: 10 }
  return {
    color: ['#31bde9'], tooltip: { trigger: 'axis', valueFormatter: (value) => `${value} ${data.unit}` },
    grid: { left: 58, right: 24, top: 36, bottom: 30 },
    xAxis: { type: 'category', boundaryGap: false, data: data.points.map((item) => item.timestamp.slice(11, 16)), axisLine: { lineStyle: { color: '#31516a' } }, axisLabel: text },
    yAxis: { type: 'value', name: `${data.name} ${data.unit}`, min: (value) => Math.floor(Math.min(value.min, data.min) * .98), max: (value) => Math.ceil(Math.max(value.max, data.max) * 1.02), nameTextStyle: text, axisLabel: text, splitLine: { lineStyle: { color: 'rgba(100,145,177,.13)', type: 'dashed' } } },
    series: [{
      name: data.name, type: 'line', smooth: true, symbol: 'circle', symbolSize: 5, data: data.points.map((item) => item.value),
      lineStyle: { width: 2 }, areaStyle: { color: 'rgba(49,189,233,.08)' },
      markArea: { silent: true, itemStyle: { color: 'rgba(43,211,152,.08)' }, data: [[{ name: '正常范围', yAxis: data.min }, { yAxis: data.max }]] },
      markLine: { silent: true, symbol: 'none', label: { color: '#89a5b7', fontSize: 9 }, data: [{ name: '上限', yAxis: data.max, lineStyle: { color: '#ffad45', type: 'dashed' } }, { name: '下限', yAxis: data.min, lineStyle: { color: '#4ab7df', type: 'dashed' } }] },
      markPoint: abnormal && data.points.length ? { symbolSize: 42, label: { formatter: '异常', fontSize: 9 }, itemStyle: { color: '#ef6262' }, data: [{ coord: [data.points.length - 1, data.points.at(-1).value] }] } : undefined,
    }],
  }
})
</script>

<template>
  <div class="trend-chart">
    <div class="chart-toolbar"><div><span>参数历史趋势</span><small>正常范围 / 上下限 / 当前异常点</small></div><el-select v-model="selectedKey" size="small"><el-option v-for="item in parameters" :key="item.key" :label="item.name" :value="item.key" /></el-select></div>
    <BaseChart v-if="selectedKey" :option="chartOption" height="250px" />
    <el-empty v-else description="当前工序暂无趋势参数" :image-size="55" />
    <footer>模拟参数趋势 · 工业仿真数据</footer>
  </div>
</template>

<style scoped>
.trend-chart{height:100%;padding:12px 14px 6px;background:#08243a;border:1px solid #1d4966}.chart-toolbar{display:flex;align-items:center;justify-content:space-between}.chart-toolbar>div{display:flex;flex-direction:column}.chart-toolbar span{color:#b9d6e7;font-size:12px}.chart-toolbar small{margin-top:3px;color:#55798f;font-size:8px}.chart-toolbar .el-select{width:150px}.trend-chart footer{color:#496e84;text-align:right;font-size:8px}
</style>
