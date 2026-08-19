<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import BaseChart from '@/components/charts/BaseChart.vue'
import BatchQualityCard from '@/components/quality/BatchQualityCard.vue'
import DefectAnalysis from '@/components/quality/DefectAnalysis.vue'
import QualityMetricCard from '@/components/quality/QualityMetricCard.vue'
import QualityTrace from '@/components/quality/QualityTrace.vue'
import { defectDistribution, inspectionItems, qualityBatches, qualityMetrics, qualityStatus, qualityTrend } from '@/mock/quality'
import { getProductionBatches } from '@/productionPlan'
import { analyzeQualityStatus, ensureQualityRecord, getBatchQuality, getQualityData, QUALITY_DATA_CHANGED } from '@/qualityData'
import { confirmQualityRecovery, continueQualityHandling, createQualityEvent, getQualityEvents, QUALITY_EVENT_CHANGED } from '@/qualityEvent'
import { createQualityInspectionTask, getQualityInspectionTasks, startQualityInspectionTask, completeQualityInspectionTask, QUALITY_INSPECTION_CHANGED } from '@/qualityInspection'

const metrics = ref(qualityMetrics.map((item) => ({ ...item })))
const batches = ref(qualityBatches.map((item) => ({ ...item })))
const keyword = ref('')
const statusFilter = ref('')
const detailVisible = ref(false)
const selectedBatch = ref(null)
const trendQualified = ref([...qualityTrend.qualified])
const trendThickness = ref([...qualityTrend.thickness])
const batchStatusMeta = { ...qualityStatus, inspecting: { label: '复检中', type: 'primary' } }
const filteredBatches = computed(() => batches.value
  .map((item) => ({ ...item, status: getBatchDisplayStatus(item) }))
  .filter((item) => (!statusFilter.value || item.status === statusFilter.value) && (!keyword.value || `${item.batchNo}${item.steelGrade}${item.specification}`.toLowerCase().includes(keyword.value.toLowerCase()))))
const productionBatches = ref(getProductionBatches())
const selectedQualityBatchId = ref(productionBatches.value.find((item) => item.processStatus === 'running')?.batchId || productionBatches.value[0]?.batchId || '')
const qualityRevision = ref(0)
const currentBatchQuality = computed(() => { qualityRevision.value; return getBatchQuality(selectedQualityBatchId.value) })
const currentQualityAnalysis = computed(() => analyzeQualityStatus(currentBatchQuality.value))
const qualityEvents = ref([])
const inspectionTasks = ref([])
const qualityEventStatus = {
  pending: { label: '待处理', type: 'warning' },
  inspecting: { label: '复检中', type: 'primary' },
  verification_pending: { label: '恢复验证', type: 'success' },
  closed: { label: '已关闭', type: 'info' },
}
const qualityEventLevel = { critical: { label: '异常', type: 'danger' }, warning: { label: '关注', type: 'warning' } }

function refreshQualityClosure() {
  qualityEvents.value = getQualityEvents()
  inspectionTasks.value = getQualityInspectionTasks()
  qualityRevision.value += 1
}
function ensureBatchQualityRecords() {
  batches.value.forEach((batch) => {
    ensureQualityRecord({
      batchId: batch.batchNo,
      steelGrade: batch.steelGrade,
      specification: batch.specification,
      quantity: batch.quantity,
      thicknessDeviation: batch.thickness,
      surfaceDefectRate: batch.defectRate,
      flatness: batch.shape,
      yieldStrength: batch.yield,
      tensileStrength: batch.tensile,
      requiresReinspection: batch.status === 'review',
      qualityDisposition: batch.qualityStatus || batch.conclusion || batch.result || batch.status,
      statusLabel: batchStatusMeta[batch.status]?.label || batch.status,
      createTime: batch.time,
      sourceBatchAnalysis: { ...batch },
    })
  })
  qualityRevision.value += 1
}
function ensureQualityEvents() {
  getQualityData().forEach((record) => createQualityEvent(record, analyzeQualityStatus(record)))
  refreshQualityClosure()
}
function taskFor(event) { return inspectionTasks.value.find((item) => item.id === event.relatedInspectionTaskId) }
function eventForBatch(batchId) { return qualityEvents.value.find((item) => item.batchId === batchId && item.status !== 'closed') || null }
function latestEventForBatch(batchId) { return qualityEvents.value.find((item) => item.batchId === batchId) || null }
function reviewTaskForBatch(batchId) {
  const event = eventForBatch(batchId) || latestEventForBatch(batchId)
  return event ? inspectionTasks.value.find((item) => item.eventId === event.id && item.status !== 'completed') || inspectionTasks.value.find((item) => item.eventId === event.id) || null : null
}
function getBatchDisplayStatus(batch) {
  qualityRevision.value
  const task = reviewTaskForBatch(batch.batchNo)
  if (task?.status === 'pending' || task?.status === 'in_progress') return 'inspecting'
  if (task?.status === 'completed') {
    const analysis = analyzeQualityStatus(getBatchQuality(batch.batchNo))
    if (['优秀', '合格'].includes(analysis?.qualityLevel?.label)) return 'qualified'
  }
  return batch.status
}
function getBatchActionLabel(batch) {
  const task = reviewTaskForBatch(batch.batchNo)
  if (task?.status === 'in_progress') return '完成复检'
  if (task?.status === 'pending') return '开始复检'
  if (task?.status === 'completed') return getBatchDisplayStatus(batch) === 'qualified' ? '复检已完成' : '查看复检'
  return '发起复检'
}
function eventActionLabel(event) {
  if (event.status === 'closed') return '已完成闭环'
  if (event.status === 'verification_pending') return event.recovery?.verificationPassed ? '确认恢复并关闭' : '继续处置'
  const task = taskFor(event)
  if (!task) return '创建复检任务'
  if (task.status === 'pending') return '开始复检'
  if (task.status === 'in_progress') return '完成复检'
  return '等待恢复确认'
}
async function operateQualityEvent(event) {
  if (event.status === 'verification_pending') {
    if (event.recovery?.verificationPassed) {
      const task = inspectionTasks.value.find((item) => item.id === event.recovery.taskId)
      const message = `批次：${event.batchId}\n复检任务：${event.recovery.taskId}\n评分：${event.recovery.scoreBefore} → ${event.recovery.scoreAfter}\n等级：${event.recovery.levelBefore} → ${event.recovery.levelAfter}\n恢复说明：${event.recovery.message}`
      const operatorResult = await ElMessageBox.prompt(message, '人工恢复确认', { inputValue: task?.operator || '质量负责人', inputPlaceholder: '确认人员', confirmButtonText: '下一步', cancelButtonText: '取消' })
      const commentResult = await ElMessageBox.prompt('请填写确认意见；关闭后将保留完整审计记录。', '确认恢复并关闭', { inputValue: '复检结果符合质量仿真恢复条件，同意关闭事件', inputPlaceholder: '确认意见', confirmButtonText: '确认关闭', cancelButtonText: '取消' })
      const result = confirmQualityRecovery({ eventId: event.id, operator: operatorResult.value, comment: commentResult.value })
      refreshQualityClosure()
      ElMessage[result.updated ? 'success' : 'warning'](result.updated ? '质量事件已人工确认恢复并关闭' : '当前事件不满足关闭条件')
    } else {
      await ElMessageBox.confirm('本次复检仍存在质量风险，将返回复检处置阶段并保留本次失败记录。', '继续质量处置', { confirmButtonText: '继续处置', cancelButtonText: '取消', type: 'warning' })
      const result = continueQualityHandling(event.id, '质量负责人', '复检未通过，安排后续复检')
      refreshQualityClosure()
      ElMessage[result.updated ? 'success' : 'warning'](result.updated ? '已返回复检处置阶段，可创建后续复检任务' : '当前事件状态不允许继续处置')
    }
    return
  }
  const task = taskFor(event)
  if (!task) {
    const result = createQualityInspectionTask(event)
    refreshQualityClosure()
    ElMessage[result.created ? 'success' : 'warning'](result.created ? `已创建复检任务 ${result.task.id}` : '该事件已有未完成复检任务')
    return
  }
  if (task.status === 'pending') {
    const { value } = await ElMessageBox.prompt('请输入复检人员', '开始质量复检', { inputValue: '质量检验员', confirmButtonText: '开始复检', cancelButtonText: '取消' })
    const result = startQualityInspectionTask(task.id, value)
    refreshQualityClosure()
    ElMessage[result.updated ? 'success' : 'warning'](result.updated ? '复检任务已进入执行中' : '任务状态不允许该操作')
    return
  }
  if (task.status === 'in_progress') {
    await ElMessageBox.confirm('完成后将写入确定性仿真复检结果，并重新计算质量评分。', '完成质量复检', { confirmButtonText: '确认完成', cancelButtonText: '取消', type: 'warning' })
    const result = completeQualityInspectionTask(task.id, task.operator)
    refreshQualityClosure()
    if (result.completed) ElMessage.success(`复检完成，质量评分更新为 ${result.analysis?.qualityScore ?? task.afterResult?.qualityScore}`)
    else ElMessage.warning('复检任务状态不允许完成')
  }
}
function handleQualityChanged() { refreshQualityClosure() }

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
async function requestReview() {
  const batchId = selectedBatch.value?.batchNo
  if (!batchId) return
  ensureBatchQualityRecords()
  let event = eventForBatch(batchId)
  if (!event) {
    const data = getBatchQuality(batchId)
    const analysis = analyzeQualityStatus(data)
    if (!data || !analysis) return ElMessage.warning('当前批次暂无可用于复检的质量检测记录')
    const eventResult = createQualityEvent(data, analysis)
    if (!eventResult.event) {
      if (import.meta.env.DEV) console.warn('[Quality] create inspection event failed', { reason: eventResult.reason, batchId })
      return ElMessage.warning(`复检事件创建失败：${eventResult.reason}`)
    }
    refreshQualityClosure()
    event = eventForBatch(batchId) || eventResult.event
  }
  const existing = reviewTaskForBatch(batchId)
  if (existing?.status === 'in_progress') {
    const result = completeQualityInspectionTask(existing.id, existing.operator)
    refreshQualityClosure()
    ElMessage[result.completed ? 'success' : 'warning'](result.completed ? `复检完成，当前质量评分 ${result.analysis?.qualityScore ?? '—'}` : '复检任务状态不允许完成')
    return
  }
  if (existing?.status === 'completed') return ElMessage.info(getBatchDisplayStatus(selectedBatch.value) === 'qualified' ? '该批次复检已完成并判定合格' : '该批次已有复检记录，请查看质量事件处置状态')
  const taskResult = existing ? { created: false, reason: 'existing_task', task: existing } : createQualityInspectionTask(event)
  const task = taskResult.task
  if (!task) {
    if (import.meta.env.DEV) console.warn('[Quality] create inspection task failed', { reason: taskResult.reason, qualityEventId: event?.id, qualityEventStatus: event?.status })
    return ElMessage.warning(`复检任务创建失败：${taskResult.reason}`)
  }
  const result = startQualityInspectionTask(task.id, '质量检验员')
  refreshQualityClosure()
  ElMessage[result.updated ? 'success' : 'warning'](result.updated ? `批次 ${batchId} 已进入复检中` : '复检任务状态不允许启动')
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
onMounted(() => {
  ensureBatchQualityRecords()
  ensureQualityEvents()
  window.addEventListener(QUALITY_EVENT_CHANGED, handleQualityChanged)
  window.addEventListener(QUALITY_INSPECTION_CHANGED, handleQualityChanged)
  window.addEventListener(QUALITY_DATA_CHANGED, handleQualityChanged)
})
onBeforeUnmount(() => {
  window.clearInterval(timer)
  window.removeEventListener(QUALITY_EVENT_CHANGED, handleQualityChanged)
  window.removeEventListener(QUALITY_INSPECTION_CHANGED, handleQualityChanged)
  window.removeEventListener(QUALITY_DATA_CHANGED, handleQualityChanged)
})
</script>

<template>
  <div class="quality-page">
    <section class="page-header"><div><p>PRODUCT QUALITY INTELLIGENCE</p><h2>厚板产品质量管理</h2></div><div class="actions"><span><i></i>模拟数据运行</span><el-button type="primary" plain size="small" @click="exportReport"><el-icon><Download /></el-icon>导出质量报告</el-button></div></section>
    <section class="metric-grid"><QualityMetricCard v-for="metric in metrics" :key="metric.key" :metric="metric" /></section>
    <section class="current-quality">
      <header><div><i></i><h3>当前批次质量分析</h3><span>CURRENT BATCH QUALITY</span></div><div class="batch-selector"><span>生产批次</span><el-select v-model="selectedQualityBatchId" size="small"><el-option v-for="item in productionBatches" :key="item.batchId" :label="`${item.batchId} · ${item.steelGrade}`" :value="item.batchId" /></el-select></div></header>
      <BatchQualityCard v-if="currentBatchQuality && currentQualityAnalysis" :data="currentBatchQuality" :analysis="currentQualityAnalysis" />
      <el-empty v-else description="暂无检测数据" :image-size="60" />
    </section>
    <section class="quality-event-panel">
      <header><div><i></i><h3>质量异常事件</h3><span>QUALITY EXCEPTION EVENTS</span></div><small>质量复检演示 · 基于工业仿真数据</small></header>
      <el-table :data="qualityEvents" class="quality-table" empty-text="暂无质量异常事件">
        <el-table-column type="expand"><template #default="scope"><div class="quality-audit"><b>质量处置审计链</b><span>初检：{{ scope.row.qualityScoreBefore }}分 · {{ scope.row.qualityLevel || (scope.row.level === 'critical' ? '异常' : '关注') }}</span><span v-for="task in inspectionTasks.filter(item => item.eventId === scope.row.id)" :key="task.id">{{ task.id }}：{{ task.status === 'completed' ? `${task.afterResult?.qualityScore}分 · ${task.afterResult?.qualityLevel}` : task.status }}</span><span v-for="item in scope.row.recoveryHistory || []" :key="item.taskId">{{ item.taskId }}：恢复未通过，已继续处置</span><span v-if="scope.row.recovery">恢复验证：{{ scope.row.recovery.message }}</span><span v-if="scope.row.closeRecord">人工关闭：{{ scope.row.closeRecord.operator }} · {{ scope.row.closeRecord.comment }} · {{ scope.row.closeRecord.time }}</span></div></template></el-table-column>
        <el-table-column prop="id" label="事件编号" min-width="145"><template #default="scope"><span class="batch-no">{{ scope.row.id }}</span></template></el-table-column>
        <el-table-column prop="batchId" label="批次" min-width="150" />
        <el-table-column prop="qualityScoreBefore" label="初始评分" width="90" />
        <el-table-column label="异常指标" min-width="180"><template #default="scope">{{ scope.row.abnormalItems.map(item => item.name).join('、') || '综合质量风险' }}</template></el-table-column>
        <el-table-column label="风险等级" width="90"><template #default="scope"><el-tag :type="qualityEventLevel[scope.row.level]?.type || 'warning'" size="small">{{ qualityEventLevel[scope.row.level]?.label || scope.row.level }}</el-tag></template></el-table-column>
        <el-table-column label="状态" width="100"><template #default="scope"><el-tag :type="qualityEventStatus[scope.row.status]?.type || 'info'" size="small" effect="dark">{{ qualityEventStatus[scope.row.status]?.label || scope.row.status }}</el-tag></template></el-table-column>
        <el-table-column label="复检结果" min-width="155"><template #default="scope"><span v-if="scope.row.recovery" class="recovery-result">{{ scope.row.recovery.scoreBefore }} → {{ scope.row.recovery.scoreAfter }} 分<br>{{ scope.row.recovery.levelBefore }} → {{ scope.row.recovery.levelAfter }}</span><span v-else class="muted">尚未复检</span></template></el-table-column>
        <el-table-column label="操作" width="140" fixed="right"><template #default="scope"><el-button link type="primary" :disabled="scope.row.status === 'closed'" @click="operateQualityEvent(scope.row)">{{ eventActionLabel(scope.row) }}</el-button></template></el-table-column>
      </el-table>
    </section>
    <DefectAnalysis :batch-id="selectedQualityBatchId" class="quality-extension" />
    <QualityTrace v-if="currentBatchQuality && currentQualityAnalysis" :quality="currentBatchQuality" :analysis="currentQualityAnalysis" class="quality-extension" />
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
        <el-table-column label="质量状态" width="90"><template #default="scope"><el-tag :type="batchStatusMeta[scope.row.status]?.type || 'info'" size="small" effect="dark">{{ batchStatusMeta[scope.row.status]?.label || scope.row.status }}</el-tag></template></el-table-column>
        <el-table-column label="操作" width="80" fixed="right"><template #default="scope"><el-button link type="primary" @click="openDetail(scope.row)">详情</el-button></template></el-table-column>
      </el-table>
    </section>

    <el-dialog v-model="detailVisible" width="720px" title="批次质量检测报告">
      <template v-if="selectedBatch">
        <div class="report-head"><div><small>BATCH QUALITY REPORT</small><h3>{{ selectedBatch.batchNo }}</h3><p>{{ selectedBatch.steelGrade }} · {{ selectedBatch.specification }} mm</p></div><div class="result"><span>综合判定</span><el-tag :type="batchStatusMeta[getBatchDisplayStatus(selectedBatch)]?.type || 'info'" effect="dark" size="large">{{ batchStatusMeta[getBatchDisplayStatus(selectedBatch)]?.label || getBatchDisplayStatus(selectedBatch) }}</el-tag></div></div>
        <div class="report-metrics"><div><span>合格率</span><b>{{ (selectedBatch.qualified/selectedBatch.quantity*100).toFixed(1) }}%</b></div><div><span>厚度偏差</span><b>{{ selectedBatch.thickness }} mm</b></div><div><span>抗拉强度</span><b>{{ selectedBatch.tensile }} MPa</b></div><div><span>屈服强度</span><b>{{ selectedBatch.yield }} MPa</b></div></div>
        <h4>检测项目明细</h4><el-table :data="inspectionItems" border size="small"><el-table-column prop="item" label="检测项目"/><el-table-column prop="method" label="检测方法"/><el-table-column prop="standard" label="执行标准"/><el-table-column prop="result" label="检测结果"/><el-table-column label="判定" width="80"><template #default><el-tag type="success" size="small">符合</el-tag></template></el-table-column></el-table>
      </template>
      <template #footer><el-button @click="detailVisible=false">关闭</el-button><el-button type="warning" plain :disabled="getBatchActionLabel(selectedBatch) === '复检已完成'" @click="requestReview">{{ getBatchActionLabel(selectedBatch) }}</el-button><el-button type="primary" @click="ElMessage.success('批次质量报告已导出')">导出报告</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.quality-page{color:#dcecf7}.page-header{display:flex;align-items:center;justify-content:space-between;padding:4px 2px 15px}.page-header p{margin:0 0 4px;color:#3d9ccb;font:10px Consolas;letter-spacing:2px}.page-header h2{margin:0;color:#edf8ff;font-size:21px}.actions{display:flex;align-items:center;gap:15px}.actions>span{color:#6e91aa;font-size:10px}.actions>span i{display:inline-block;width:7px;height:7px;margin-right:7px;border-radius:50%;background:#2bd398;box-shadow:0 0 8px #2bd398}.metric-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:12px}.current-quality{margin-bottom:12px;padding:0 14px 14px;background:linear-gradient(145deg,#0a2b46,#071f34);border:1px solid #204c6c}.current-quality>header{display:flex;align-items:center;justify-content:space-between;height:46px}.current-quality header>div:first-child{display:flex;align-items:center;gap:8px}.current-quality header i{width:3px;height:15px;background:#2bd398;box-shadow:0 0 8px #2bd398}.current-quality h3{margin:0;font-size:14px}.current-quality header span{color:#49748e;font:9px Consolas}.batch-selector{display:flex;align-items:center;gap:8px}.batch-selector .el-select{width:235px}.quality-extension{margin-bottom:12px}.chart-grid{display:grid;grid-template-columns:1.6fr 1fr;gap:12px;margin-bottom:12px}.panel,.batch-panel{padding:14px 16px 5px;background:linear-gradient(145deg,#0a2b46,#071f34);border:1px solid #204c6c}.panel>header,.batch-panel>header{height:32px;display:flex;align-items:flex-start;justify-content:space-between;border-bottom:1px solid rgba(55,107,142,.35)}.panel header>div,.batch-panel header>div:first-child{display:flex;align-items:center;gap:8px}.panel header i,.batch-panel header i{width:3px;height:15px;background:#2bb7ec;box-shadow:0 0 8px #2bb7ec}.panel h3,.batch-panel h3{margin:0;color:#dceefa;font-size:14px}.panel header span,.batch-panel header span{color:#49748e;font:9px Consolas;letter-spacing:1px}.panel header em{color:#567b94;font-size:9px;font-style:normal}.batch-panel{padding-bottom:14px}.batch-panel>header{height:42px}.filters{display:flex;gap:8px;width:420px}.filters .el-input{flex:1}.filters .el-select{width:120px}.quality-table{--el-table-bg-color:#0a2942;--el-table-tr-bg-color:#0a2942;--el-table-row-hover-bg-color:#123d5b;--el-table-header-bg-color:#0d3451;--el-table-border-color:#204760;--el-table-text-color:#a9c1d0;--el-table-header-text-color:#7195ad;font-size:11px}.batch-no{color:#42b9ef;font:11px Consolas}.exceed{color:#ff6b6b}.report-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:#eef5f8;border-left:4px solid #2597d2}.report-head small{color:#3287b5;font:9px Consolas;letter-spacing:2px}.report-head h3{margin:4px 0;color:#243e52;font:600 19px Consolas}.report-head p{margin:0;color:#8194a1;font-size:11px}.result{display:flex;flex-direction:column;align-items:flex-end;gap:7px}.result span{color:#8495a1;font-size:10px}.report-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}.report-metrics>div{display:flex;flex-direction:column;padding:12px;background:#f5f8fa;border:1px solid #e1e9ee}.report-metrics span{color:#82929e;font-size:10px}.report-metrics b{margin-top:5px;color:#267ba8;font:600 16px Consolas}.quality-page :deep(.el-dialog h4){margin:17px 0 9px;color:#354e61;font-size:13px}@media(max-width:1300px){.metric-grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:900px){.metric-grid{grid-template-columns:repeat(2,1fr)}.chart-grid{grid-template-columns:1fr}.page-header{align-items:flex-start;flex-direction:column;gap:10px}}@media(max-width:600px){.metric-grid{grid-template-columns:1fr}.filters{width:100%}.batch-panel>header{height:auto;gap:10px;flex-direction:column;padding-bottom:10px}.current-quality>header{height:auto;align-items:flex-start;flex-direction:column;gap:8px;padding:10px 0}}
.quality-event-panel{margin-bottom:12px;padding:0 14px 14px;background:linear-gradient(145deg,#0a2b46,#071f34);border:1px solid #204c6c}.quality-event-panel>header{display:flex;align-items:center;justify-content:space-between;height:46px;border-bottom:1px solid rgba(55,107,142,.35)}.quality-event-panel header>div{display:flex;align-items:center;gap:8px}.quality-event-panel header i{width:3px;height:15px;background:#ffad45;box-shadow:0 0 8px #ffad45}.quality-event-panel h3{margin:0;font-size:14px}.quality-event-panel header span,.quality-event-panel header small{color:#55798f;font:9px Consolas}.recovery-result{color:#2bd398;font:10px/1.5 Consolas}.muted{color:#55778d}
.quality-audit{display:flex;gap:9px;flex-direction:column;padding:12px 24px;color:#7898ab;background:#071f34}.quality-audit b{color:#d7e9f3}.quality-audit span{padding-left:12px;border-left:2px solid #2bb7ec;font-size:10px}
</style>
