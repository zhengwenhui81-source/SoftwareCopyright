<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import * as Icons from '@element-plus/icons-vue'
import BaseChart from '@/components/charts/BaseChart.vue'
import { dashboardMetrics, energyData, equipmentHealthData, fluctuate, outputData, temperatureData } from '@/mock/dashboard'

const lastUpdate = ref(new Date())
const metrics = ref(dashboardMetrics.map((item) => ({ ...item })))
const temperatures = ref({ slab: [...temperatureData.slab], rolling: [...temperatureData.rolling] })
const outputs = ref([...outputData.values])
const equipment = ref(equipmentHealthData.map((item) => ({ ...item })))
const energy = ref([...energyData.current])
const timeText = computed(() => lastUpdate.value.toLocaleTimeString('zh-CN', { hour12: false }))
const textStyle = { color: '#8ca3bd', fontFamily: 'Microsoft YaHei' }
const axisLine = { lineStyle: { color: '#29465f' } }
const splitLine = { lineStyle: { color: 'rgba(106, 151, 190, .14)', type: 'dashed' } }

const temperatureOption = computed(() => ({
  animationDuration: 650, color: ['#ffb445', '#23d5e5'],
  tooltip: { trigger: 'axis', valueFormatter: (value) => `${value} ℃` },
  legend: { right: 8, top: 0, textStyle, data: ['板坯温度', '轧制温度'] },
  grid: { left: 48, right: 20, top: 42, bottom: 30 },
  xAxis: { type: 'category', data: temperatureData.times, boundaryGap: false, axisLine, axisLabel: textStyle },
  yAxis: { type: 'value', min: 1000, max: 1280, name: '℃', nameTextStyle: textStyle, axisLine, axisLabel: textStyle, splitLine },
  series: [
    { name: '板坯温度', type: 'line', smooth: true, symbolSize: 7, data: temperatures.value.slab, lineStyle: { width: 3 }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(255,180,69,.3)' }, { offset: 1, color: 'rgba(255,180,69,0)' }] } } },
    { name: '轧制温度', type: 'line', smooth: true, symbolSize: 7, data: temperatures.value.rolling, lineStyle: { width: 3 } },
  ],
}))

const outputOption = computed(() => ({
  color: ['#238df5', '#54d6c4'], tooltip: { trigger: 'axis', valueFormatter: (value) => `${value} t` },
  legend: { right: 8, top: 0, textStyle }, grid: { left: 45, right: 16, top: 42, bottom: 28 },
  xAxis: { type: 'category', data: outputData.times, axisLine, axisLabel: textStyle },
  yAxis: { type: 'value', name: '吨', nameTextStyle: textStyle, axisLabel: textStyle, splitLine },
  series: [
    { name: '实际产量', type: 'bar', barWidth: 18, data: outputs.value, itemStyle: { borderRadius: [4, 4, 0, 0], color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#3ca7ff' }, { offset: 1, color: '#1764c0' }] } } },
    { name: '计划产量', type: 'line', smooth: true, symbol: 'none', lineStyle: { type: 'dashed', width: 2 }, data: outputData.target },
  ],
}))

const healthOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}<br/>健康评分：{c} 分' },
  radar: { radius: '64%', indicator: equipmentHealthData.map((item) => ({ name: item.name, max: 100 })), axisName: textStyle, splitNumber: 4, axisLine: { lineStyle: { color: '#31506b' } }, splitLine: { lineStyle: { color: '#2b485f' } }, splitArea: { areaStyle: { color: ['rgba(21,64,93,.15)', 'rgba(21,64,93,.3)'] } } },
  series: [{ type: 'radar', data: [{ value: equipment.value.map((item) => item.value), name: '健康评分', symbolSize: 6, lineStyle: { color: '#36d6c5', width: 2 }, itemStyle: { color: '#36d6c5' }, areaStyle: { color: 'rgba(54,214,197,.25)' } }] }],
}))

const energyOption = computed(() => ({
  color: ['#31a8ff', '#697d91'], tooltip: { trigger: 'axis', valueFormatter: (value) => `${value}%` },
  legend: { right: 8, top: 0, textStyle }, grid: { left: 80, right: 20, top: 42, bottom: 25 },
  xAxis: { type: 'value', max: 100, axisLabel: { ...textStyle, formatter: '{value}%' }, splitLine },
  yAxis: { type: 'category', data: energyData.names, axisLine, axisLabel: textStyle },
  series: [
    { name: '实时能耗', type: 'bar', barWidth: 11, data: energy.value, itemStyle: { borderRadius: 6 } },
    { name: '基准能耗', type: 'bar', barWidth: 11, data: energyData.baseline, itemStyle: { borderRadius: 6, opacity: .55 } },
  ],
}))

function updateRealtimeData() {
  const outputMetric = metrics.value.find((item) => item.key === 'output')
  const equipmentMetric = metrics.value.find((item) => item.key === 'equipmentRate')
  const qualityMetric = metrics.value.find((item) => item.key === 'qualityRate')
  outputMetric.value += Math.floor(Math.random() * 4 + 1)
  equipmentMetric.value = fluctuate(equipmentMetric.value, 0.6, 1)
  qualityMetric.value = fluctuate(qualityMetric.value, 0.2, 1)
  temperatures.value.slab = temperatures.value.slab.map((value) => fluctuate(value, 8))
  temperatures.value.rolling = temperatures.value.rolling.map((value) => fluctuate(value, 7))
  outputs.value = outputs.value.map((value) => Math.max(0, fluctuate(value, 10)))
  equipment.value = equipment.value.map((item) => ({ ...item, value: Math.min(100, Math.max(75, fluctuate(item.value, 2))) }))
  energy.value = energy.value.map((value) => Math.min(100, Math.max(0, fluctuate(value, 3))))
  lastUpdate.value = new Date()
}

const timer = window.setInterval(updateRealtimeData, 3000)
onBeforeUnmount(() => window.clearInterval(timer))
</script>

<template>
  <div class="dashboard">
    <section class="cockpit-header">
      <div><p class="eyebrow">INDUSTRIAL INTELLIGENT COCKPIT</p><h2>基于工业基座大模型的厚板生产全流程运行监控系统</h2></div>
      <div class="realtime"><span class="pulse"></span>工业仿真数据 <b>{{ timeText }}</b></div>
    </section>
    <section class="metric-grid">
      <article v-for="item in metrics" :key="item.key" class="metric-card" :class="`tone-${item.tone}`">
        <div class="metric-icon"><el-icon><component :is="Icons[item.icon]" /></el-icon></div>
        <div class="metric-info"><span>{{ item.label }}</span><strong>{{ item.value }}<small>{{ item.unit }}</small></strong><em>{{ item.trend }}</em></div>
      </article>
    </section>
    <section class="chart-grid">
      <article class="panel"><header><div><i></i><h3>生产温度变化趋势</h3></div><span>TEMPERATURE TREND</span></header><BaseChart :option="temperatureOption" height="300px" /></article>
      <article class="panel"><header><div><i></i><h3>产量统计</h3></div><span>OUTPUT STATISTICS</span></header><BaseChart :option="outputOption" height="300px" /></article>
      <article class="panel"><header><div><i></i><h3>设备健康分析</h3></div><span>EQUIPMENT HEALTH</span></header><BaseChart :option="healthOption" height="280px" /></article>
      <article class="panel"><header><div><i></i><h3>能源消耗分析</h3></div><span>ENERGY CONSUMPTION</span></header><BaseChart :option="energyOption" height="280px" /></article>
    </section>
  </div>
</template>

<style scoped>
.dashboard { color:#d8e9f7; }.cockpit-header { min-height:74px;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:14px 20px;margin-bottom:16px;background:linear-gradient(90deg,rgba(14,55,86,.96),rgba(13,40,66,.9));border:1px solid #215276;box-shadow:inset 0 0 24px rgba(22,132,210,.08) }.eyebrow{margin:0 0 5px;font-size:10px;letter-spacing:3px;color:#42bff2}.cockpit-header h2{margin:0;color:#eef9ff;font-size:clamp(16px,1.5vw,22px);font-weight:600;letter-spacing:1px}.realtime{flex:0 0 auto;color:#8daac0;font-size:12px}.realtime b{margin-left:8px;color:#53c8ff;font-family:Consolas,monospace}.pulse{display:inline-block;width:8px;height:8px;margin-right:8px;border-radius:50%;background:#26dc9c;box-shadow:0 0 0 5px rgba(38,220,156,.12);animation:pulse 1.6s infinite}.metric-grid{display:grid;grid-template-columns:repeat(5,minmax(160px,1fr));gap:14px;margin-bottom:14px}.metric-card{--accent:#2d9cff;position:relative;display:flex;align-items:center;gap:14px;min-height:112px;padding:18px;overflow:hidden;background:linear-gradient(135deg,rgba(14,48,75,.97),rgba(10,36,59,.95));border:1px solid #234c6a;box-shadow:inset 3px 0 0 var(--accent)}.metric-card::after{content:'';position:absolute;width:90px;height:90px;right:-40px;top:-40px;border:1px solid color-mix(in srgb,var(--accent) 30%,transparent);transform:rotate(45deg)}.tone-green{--accent:#29d594}.tone-blue{--accent:#2d9cff}.tone-cyan{--accent:#25d1de}.tone-purple{--accent:#9b82ff}.tone-orange{--accent:#ff9e42}.metric-icon{flex:0 0 44px;height:44px;display:grid;place-items:center;color:var(--accent);font-size:25px;background:color-mix(in srgb,var(--accent) 12%,transparent);border:1px solid color-mix(in srgb,var(--accent) 35%,transparent);transform:rotate(45deg)}.metric-icon .el-icon{transform:rotate(-45deg)}.metric-info{display:flex;flex-direction:column;min-width:0}.metric-info>span{color:#8da8bd;font-size:12px}.metric-info strong{margin:4px 0 3px;color:#f2fbff;font:600 25px/1.1 Consolas,"Microsoft YaHei";white-space:nowrap}.metric-info small{margin-left:4px;color:var(--accent);font:12px "Microsoft YaHei"}.metric-info em{color:#6f91aa;font-size:10px;font-style:normal;white-space:nowrap}.chart-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.panel{min-width:0;padding:15px 16px 8px;background:linear-gradient(145deg,rgba(11,42,68,.98),rgba(8,31,51,.98));border:1px solid #204c6c;box-shadow:0 8px 24px rgba(1,17,31,.16),inset 0 0 28px rgba(32,129,191,.035)}.panel header{height:28px;display:flex;align-items:flex-start;justify-content:space-between;border-bottom:1px solid rgba(64,121,158,.25)}.panel header div{display:flex;align-items:center;gap:9px}.panel header i{width:3px;height:15px;background:#28a9ec;box-shadow:0 0 8px #28a9ec}.panel h3{margin:0;color:#dceefa;font-size:14px;font-weight:600}.panel header>span{color:#416b87;font:9px Consolas;letter-spacing:1px}@keyframes pulse{50%{box-shadow:0 0 0 9px rgba(38,220,156,0)}}@media(max-width:1200px){.metric-grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:800px){.metric-grid,.chart-grid{grid-template-columns:1fr}.cockpit-header{align-items:flex-start;flex-direction:column}}
</style>
