<script setup>
import { computed, ref } from 'vue'
import BaseChart from '@/components/charts/BaseChart.vue'
import FailurePrediction from '@/components/equipment/FailurePrediction.vue'
import { equipmentList } from '@/mock/equipment'
import { analyzeRiskFactors, evaluateEquipmentHealth, simulateFailureProbability } from '@/equipmentHealth'

const failureCatalog = {
  vibration: '主传动轴承异常', temperature: '冷却或散热系统异常', pressure: '液压系统压力异常', load: '主传动过载风险', runtime: '关键部件寿命衰减',
}

const records = equipmentList.map((device) => {
  const evaluation = evaluateEquipmentHealth(device)
  const riskFactors = analyzeRiskFactors(device)
  const failureProbability = simulateFailureProbability(device, evaluation.score, riskFactors)
  const primaryRisk = riskFactors.find((item) => item.severity === 'high') || riskFactors[0]
  const riskLevel = failureProbability >= 50 ? '高风险' : failureProbability >= 20 ? '中风险' : '低风险'
  return {
    ...evaluation,
    id: device.id,
    name: device.name,
    type: device.type,
    device,
    riskFactors,
    failureProbability,
    riskLevel,
    riskSummary: riskFactors.length ? riskFactors.map((item) => `${item.label}超过阈值`).join('、') : '关键参数处于正常区间',
    predictedFailure: primaryRisk ? failureCatalog[primaryRisk.key] : '暂未识别明显故障倾向',
    riskComponent: evaluation.diagnosis.possibleRiskComponent,
    reason: primaryRisk ? `${primaryRisk.label}达到 ${primaryRisk.value} ${primaryRisk.unit}，超过模拟预警阈值 ${primaryRisk.warningThreshold} ${primaryRisk.unit}。` : '当前关键参数未超过模拟预警阈值，故障概率处于较低水平。',
    suggestion: riskLevel === '高风险' ? '建议24小时内安排专项检查。' : riskLevel === '中风险' ? '建议加强巡检并复核异常参数。' : '保持例行巡检并持续观察趋势。',
    recommendedChecks: evaluation.diagnosis.recommendedChecks,
  }
})

const selectedId = ref(records[0].id)
const selected = computed(() => records.find((item) => item.id === selectedId.value) || records[0])
const normalCount = computed(() => records.filter((item) => item.riskLevel === '低风险').length)
const riskCount = computed(() => records.filter((item) => item.riskLevel !== '低风险').length)
const highRiskCount = computed(() => records.filter((item) => item.riskLevel === '高风险').length)
const averageProbability = computed(() => Math.round(records.reduce((sum, item) => sum + item.failureProbability, 0) / records.length))
const trendLabels = ['-7d', '-6d', '-5d', '-4d', '-3d', '-2d', '当前']

const chartOption = computed(() => {
  const score = selected.value.score
  const probability = selected.value.failureProbability
  const scoreTrend = trendLabels.map((_, index) => Math.min(100, Math.round(score + (6 - index) * 1.5 + Math.sin(index + selected.value.id.length))))
  const probabilityTrend = trendLabels.map((_, index) => Math.max(3, Math.round(probability - (6 - index) * 2.2 + Math.cos(index) * 1.5)))
  const axisText = { color: '#7896ac', fontSize: 10 }
  return {
    color: ['#32d5c4', '#ffad45'], tooltip: { trigger: 'axis' },
    legend: { right: 12, top: 2, textStyle: axisText }, grid: { left: 45, right: 45, top: 42, bottom: 28 },
    xAxis: { type: 'category', data: trendLabels, boundaryGap: false, axisLine: { lineStyle: { color: '#31516a' } }, axisLabel: axisText },
    yAxis: [{ type: 'value', name: '健康评分', min: 0, max: 100, nameTextStyle: axisText, axisLabel: axisText, splitLine: { lineStyle: { color: 'rgba(100,145,177,.13)', type: 'dashed' } } }, { type: 'value', name: '故障概率 %', min: 0, max: 100, nameTextStyle: axisText, axisLabel: axisText, splitLine: { show: false } }],
    series: [{ name: '健康评分趋势', type: 'line', smooth: true, data: scoreTrend, areaStyle: { color: 'rgba(50,213,196,.08)' } }, { name: '故障概率趋势', type: 'line', yAxisIndex: 1, smooth: true, data: probabilityTrend, areaStyle: { color: 'rgba(255,173,69,.06)' } }],
  }
})
</script>

<template>
  <div class="prediction-page">
    <section class="page-header"><div><p>EQUIPMENT FAILURE RISK PREDICTION</p><h2>设备故障风险预测中心</h2></div><span><i></i>故障预测演示 · 基于工业仿真数据</span></section>
    <section class="overview">
      <div><span>设备总数</span><strong>{{ records.length }}<small>台/套</small></strong><el-icon><Cpu /></el-icon></div>
      <div><span>正常设备</span><strong class="green">{{ normalCount }}<small>台/套</small></strong><el-icon><CircleCheck /></el-icon></div>
      <div><span>风险设备</span><strong class="orange">{{ riskCount }}<small>台/套</small></strong><el-icon><Warning /></el-icon></div>
      <div><span>高风险设备</span><strong class="red">{{ highRiskCount }}<small>台/套</small></strong><el-icon><WarnTriangleFilled /></el-icon></div>
      <div><span>平均故障概率</span><strong class="cyan">{{ averageProbability }}<small>%</small></strong><el-icon><DataAnalysis /></el-icon></div>
    </section>

    <FailurePrediction :records="records" :selected-id="selectedId" @select="selectedId = $event" />

    <section class="trend-panel"><header><div><i></i><h3>{{ selected.name }} · 风险趋势分析</h3><span>{{ selected.id }} SIMULATED PREDICTION TREND</span></div><small>模拟预测趋势 · 故障预测演示 · 基于工业仿真数据</small></header><BaseChart :option="chartOption" height="285px" /></section>
  </div>
</template>

<style scoped>
.prediction-page{color:#dcecf7}.page-header{display:flex;align-items:center;justify-content:space-between;padding:4px 2px 15px}.page-header p{margin:0 0 4px;color:#3d9ccb;font:10px Consolas;letter-spacing:2px}.page-header h2{margin:0;color:#edf8ff;font-size:21px}.page-header>span{color:#6e91aa;font-size:11px}.page-header i{display:inline-block;width:7px;height:7px;margin-right:7px;border-radius:50%;background:#ffad45;box-shadow:0 0 8px #ffad45}.overview{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:12px}.overview>div{position:relative;min-height:82px;padding:15px 18px;overflow:hidden;background:linear-gradient(135deg,#0d3554,#092640);border:1px solid #214d6b}.overview span{display:block;color:#7293aa;font-size:10px}.overview strong{display:block;margin-top:7px;color:#dcecf7;font:600 25px Consolas}.overview small{margin-left:4px;color:#6d8da4;font:10px "Microsoft YaHei"}.overview .el-icon{position:absolute;right:18px;top:25px;color:#245f82;font-size:30px}.green{color:#2bd398!important}.orange{color:#ffad45!important}.red{color:#ef6262!important}.cyan{color:#31c9df!important}.trend-panel{margin-top:12px;padding:0 15px 4px;background:linear-gradient(145deg,#0a2b46,#071f34);border:1px solid #204c6c}.trend-panel>header{display:flex;align-items:center;justify-content:space-between;height:45px;border-bottom:1px solid rgba(55,107,142,.35)}.trend-panel header>div{display:flex;align-items:center;gap:8px}.trend-panel header i{width:3px;height:15px;background:#2bb7ec;box-shadow:0 0 8px #2bb7ec}.trend-panel h3{margin:0;font-size:14px}.trend-panel header span,.trend-panel header small{color:#557a92;font:9px Consolas}@media(max-width:1200px){.overview{grid-template-columns:repeat(3,1fr)}}@media(max-width:700px){.overview{grid-template-columns:repeat(2,1fr)}.page-header{align-items:flex-start;flex-direction:column;gap:8px}}
</style>
