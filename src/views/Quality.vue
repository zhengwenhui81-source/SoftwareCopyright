<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { ElMessage } from 'element-plus'
import BaseChart from '@/components/charts/BaseChart.vue'
import QualityMetricCard from '@/components/quality/QualityMetricCard.vue'
import { defectDistribution, inspectionItems, qualityBatches, qualityMetrics, qualityStatus, qualityTrend } from '@/mock/quality'

const metrics = ref(qualityMetrics.map((item) => ({ ...item })))
const batches = ref(qualityBatches.map((item) => ({ ...item })))
const keyword = ref('')
const statusFilter = ref('')
const detailVisible = ref(false)
const selectedBatch = ref(null)
const trendQualified = ref([...qualityTrend.qualified])
const trendThickness = ref([...qualityTrend.thickness])
const filteredBatches = computed(() => batches.value.filter((item) => (!statusFilter.value || item.status === statusFilter.value) && (!keyword.value || `${item.batchNo}${item.steelGrade}${item.specification}`.toLowerCase().includes(keyword.value.toLowerCase()))))

const text = { color: '#7897ad', fontSize: 10 }
const trendOption = computed(() => ({
  color: ['#2ed09a', '#36a5ef'], tooltip: { trigger: 'axis' }, legend: { right: 8, top: 0, textStyle: text },
  grid: { left: 48, right: 48, top: 42, bottom: 28 }, xAxis: { type: 'category', data: qualityTrend.dates, boundaryGap: false, axisLine: { lineStyle: { color: '#31516a' } }, axisLabel: text },
  yAxis: [
    { type: 'value', min: 96, max: 100, name: '合格率 %', nameTextStyle: text, axisLabel: { ...text, formatter: '{value}%' }, splitLine: { lineStyle: { color: 'rgba(100,145,177,.13)', type: 'dashed' } } },
    { type: 'value', min: 0, max: .4, name: '偏差 mm', nameTextStyle: text, axisLabel: text, splitLine: { show: false } },
  ],
  series: [
    { name: '产品合格率', type: 'line', smooth: true, symbolSize: 7, data: trendQualified.value, areaStyle: { color: 'rgba(46,208,154,.1)' }, markLine: { symbol: 'none', label: { color: '#758fa3', formatter: '目标 98%' }, lineStyle: { color: '#e2a648', type: 'dashed' }, data: [{ yAxis: 98 }] } },
    { name: '平均厚度偏差', type: 'line', smooth: true, yAxisIndex: 1, symbolSize: 7, data: trendThickness.value },
  ],
}))

const defectOption = computed(() => ({
  color: ['#28c99a', '#3a9fe8', '#f1a743', '#eb6464', '#8e7de5'], tooltip: { trigger: 'item', formatter: '{b}<br/>{c}%（{d}%）' },
  legend: { type: 'scroll', bottom: 0, textStyle: text },
  series: [{ name: '缺陷分布', type: 'pie', radius: ['47%', '70%'], center: ['50%', '45%'], itemStyle: { borderColor: '#09263e', borderWidth: 3 }, label: { color: '#8ea8ba', formatter: '{b}\n{c}%' }, data: defectDistribution }],
  graphic: [{ type: 'text', left: 'center', top: '38%', style: { text: '94.8%\n无缺陷', textAlign: 'center', fill: '#dceefa', fontSize: 15, lineHeight: 22 } }],
}))

function openDetail(row) { selectedBatch.value = row; detailVisible.value = true }
function requestReview() {
  selectedBatch.value.status = 'review'
  ElMessage.success(`批次 ${selectedBatch.value.batchNo} 已提交复检任务`)
  detailVisible.value = false
}
function exportReport() { ElMessage.success('质量分析报告已生成（Demo）') }
function updateQuality() {
  metrics.value.forEach((metric) => {
    if (typeof metric.value !== 'number') return
    const amplitude = metric.key === 'thickness' ? .012 : .08
    metric.value = Number((metric.value + (Math.random() - .5) * amplitude).toFixed(metric.key === 'thickness' ? 2 : metric.key === 'shape' ? 1 : 2))
  })
  trendQualified.value = [...trendQualified.value.slice(1), metrics.value.find((item) => item.key === 'qualified').value]
  trendThickness.value = [...trendThickness.value.slice(1), metrics.value.find((item) => item.key === 'thickness').value]
}
const timer = window.setInterval(updateQuality, 4000)
onBeforeUnmount(() => window.clearInterval(timer))
</script>

<template>
  <div class="quality-page">
    <section class="page-header"><div><p>PRODUCT QUALITY INTELLIGENCE</p><h2>厚板产品质量管理</h2></div><div class="actions"><span><i></i>模拟数据运行</span><el-button type="primary" plain size="small" @click="exportReport"><el-icon><Download /></el-icon>导出质量报告</el-button></div></section>
    <section class="metric-grid"><QualityMetricCard v-for="metric in metrics" :key="metric.key" :metric="metric" /></section>
    <section class="chart-grid">
      <article class="panel trend"><header><div><i></i><h3>质量趋势分析</h3><span>QUALITY TREND</span></div><em>最近 7 个生产日</em></header><BaseChart :option="trendOption" height="285px" /></article>
      <article class="panel"><header><div><i></i><h3>表面缺陷分布</h3><span>DEFECT DISTRIBUTION</span></div><em>视觉检测统计</em></header><BaseChart :option="defectOption" height="285px" /></article>
    </section>
    <section class="batch-panel">
      <header><div><i></i><h3>批次质量分析</h3><span>BATCH QUALITY ANALYSIS</span></div><div class="filters"><el-input v-model="keyword" placeholder="批次号 / 钢种 / 规格" clearable size="small" prefix-icon="Search" /><el-select v-model="statusFilter" placeholder="全部状态" clearable size="small"><el-option label="合格" value="qualified"/><el-option label="待复检" value="review"/><el-option label="不合格" value="unqualified"/></el-select></div></header>
      <el-table :data="filteredBatches" class="quality-table" height="318" @row-dblclick="openDetail">
        <el-table-column prop="batchNo" label="批次编号" min-width="155"><template #default="scope"><span class="batch-no">{{ scope.row.batchNo }}</span></template></el-table-column>
        <el-table-column prop="steelGrade" label="钢种" width="90"/><el-table-column prop="specification" label="产品规格(mm)" min-width="150"/>
        <el-table-column label="合格数量" width="105"><template #default="scope"><b>{{ scope.row.qualified }}</b> / {{ scope.row.quantity }}</template></el-table-column>
        <el-table-column label="厚度偏差" width="105"><template #default="scope"><span :class="{ exceed: scope.row.thickness > .25 }">{{ scope.row.thickness }} mm</span></template></el-table-column>
        <el-table-column prop="shape" label="板形评分" width="95"/><el-table-column label="缺陷率" width="90"><template #default="scope"><span :class="{ exceed: scope.row.defectRate > .5 }">{{ scope.row.defectRate }}%</span></template></el-table-column>
        <el-table-column prop="inspector" label="检验员" width="80"/><el-table-column prop="time" label="检验时间" width="100"/>
        <el-table-column label="质量状态" width="90"><template #default="scope"><el-tag :type="qualityStatus[scope.row.status].type" size="small" effect="dark">{{ qualityStatus[scope.row.status].label }}</el-tag></template></el-table-column>
        <el-table-column label="操作" width="80" fixed="right"><template #default="scope"><el-button link type="primary" @click="openDetail(scope.row)">详情</el-button></template></el-table-column>
      </el-table>
    </section>

    <el-dialog v-model="detailVisible" width="720px" title="批次质量检测报告">
      <template v-if="selectedBatch">
        <div class="report-head"><div><small>BATCH QUALITY REPORT</small><h3>{{ selectedBatch.batchNo }}</h3><p>{{ selectedBatch.steelGrade }} · {{ selectedBatch.specification }} mm</p></div><div class="result"><span>综合判定</span><el-tag :type="qualityStatus[selectedBatch.status].type" effect="dark" size="large">{{ qualityStatus[selectedBatch.status].label }}</el-tag></div></div>
        <div class="report-metrics"><div><span>合格率</span><b>{{ (selectedBatch.qualified/selectedBatch.quantity*100).toFixed(1) }}%</b></div><div><span>厚度偏差</span><b>{{ selectedBatch.thickness }} mm</b></div><div><span>抗拉强度</span><b>{{ selectedBatch.tensile }} MPa</b></div><div><span>屈服强度</span><b>{{ selectedBatch.yield }} MPa</b></div></div>
        <h4>检测项目明细</h4><el-table :data="inspectionItems" border size="small"><el-table-column prop="item" label="检测项目"/><el-table-column prop="method" label="检测方法"/><el-table-column prop="standard" label="执行标准"/><el-table-column prop="result" label="检测结果"/><el-table-column label="判定" width="80"><template #default><el-tag type="success" size="small">符合</el-tag></template></el-table-column></el-table>
      </template>
      <template #footer><el-button @click="detailVisible=false">关闭</el-button><el-button type="warning" plain @click="requestReview">发起复检</el-button><el-button type="primary" @click="ElMessage.success('批次质量报告已导出')">导出报告</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.quality-page{color:#dcecf7}.page-header{display:flex;align-items:center;justify-content:space-between;padding:4px 2px 15px}.page-header p{margin:0 0 4px;color:#3d9ccb;font:10px Consolas;letter-spacing:2px}.page-header h2{margin:0;color:#edf8ff;font-size:21px}.actions{display:flex;align-items:center;gap:15px}.actions>span{color:#6e91aa;font-size:10px}.actions>span i{display:inline-block;width:7px;height:7px;margin-right:7px;border-radius:50%;background:#2bd398;box-shadow:0 0 8px #2bd398}.metric-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:12px}.chart-grid{display:grid;grid-template-columns:1.6fr 1fr;gap:12px;margin-bottom:12px}.panel,.batch-panel{padding:14px 16px 5px;background:linear-gradient(145deg,#0a2b46,#071f34);border:1px solid #204c6c}.panel>header,.batch-panel>header{height:32px;display:flex;align-items:flex-start;justify-content:space-between;border-bottom:1px solid rgba(55,107,142,.35)}.panel header>div,.batch-panel header>div:first-child{display:flex;align-items:center;gap:8px}.panel header i,.batch-panel header i{width:3px;height:15px;background:#2bb7ec;box-shadow:0 0 8px #2bb7ec}.panel h3,.batch-panel h3{margin:0;color:#dceefa;font-size:14px}.panel header span,.batch-panel header span{color:#49748e;font:9px Consolas;letter-spacing:1px}.panel header em{color:#567b94;font-size:9px;font-style:normal}.batch-panel{padding-bottom:14px}.batch-panel>header{height:42px}.filters{display:flex;gap:8px;width:420px}.filters .el-input{flex:1}.filters .el-select{width:120px}.quality-table{--el-table-bg-color:#0a2942;--el-table-tr-bg-color:#0a2942;--el-table-row-hover-bg-color:#123d5b;--el-table-header-bg-color:#0d3451;--el-table-border-color:#204760;--el-table-text-color:#a9c1d0;--el-table-header-text-color:#7195ad;font-size:11px}.batch-no{color:#42b9ef;font:11px Consolas}.exceed{color:#ff6b6b}.report-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:#eef5f8;border-left:4px solid #2597d2}.report-head small{color:#3287b5;font:9px Consolas;letter-spacing:2px}.report-head h3{margin:4px 0;color:#243e52;font:600 19px Consolas}.report-head p{margin:0;color:#8194a1;font-size:11px}.result{display:flex;flex-direction:column;align-items:flex-end;gap:7px}.result span{color:#8495a1;font-size:10px}.report-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}.report-metrics>div{display:flex;flex-direction:column;padding:12px;background:#f5f8fa;border:1px solid #e1e9ee}.report-metrics span{color:#82929e;font-size:10px}.report-metrics b{margin-top:5px;color:#267ba8;font:600 16px Consolas}.quality-page :deep(.el-dialog h4){margin:17px 0 9px;color:#354e61;font-size:13px}@media(max-width:1300px){.metric-grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:900px){.metric-grid{grid-template-columns:repeat(2,1fr)}.chart-grid{grid-template-columns:1fr}.page-header{align-items:flex-start;flex-direction:column;gap:10px}}@media(max-width:600px){.metric-grid{grid-template-columns:1fr}.filters{width:100%}.batch-panel>header{height:auto;gap:10px;flex-direction:column;padding-bottom:10px}}
</style>
