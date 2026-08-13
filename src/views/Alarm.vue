<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { ElMessage } from 'element-plus'
import BaseChart from '@/components/charts/BaseChart.vue'
import { alarmLevels, alarmRecords, alarmTrend } from '@/mock/alarm'
import { getLinkedAlarms, subscribeLinkedAlarms } from '@/industrialAlarmLink'
import {
  ALARM_EVENT_CHANGED,
  acknowledgeAlarm,
  appendAlarmAction,
  closeAlarmEvent,
  createAlarmEvent,
  getAlarmEvents,
  returnAlarmToProcessing,
  syncBusinessEventsToAlarms,
  startAlarmProcessing,
  submitRecoveryVerification,
} from '@/alarmEvent'

const statusMeta = {
  new: { label: '新报警', type: 'danger' },
  acknowledged: { label: '已确认', type: 'warning' },
  processing: { label: '处理中', type: 'warning' },
  recovery_pending: { label: '恢复验证', type: 'primary' },
  closed: { label: '已关闭', type: 'success' },
  cancelled: { label: '已取消', type: 'info' },
}
const sourceLabels = {
  production_alarm: '生产参数报警',
  production_event: '生产异常事件',
  equipment_event: '设备风险事件',
  quality_event: '严重质量异常',
  maintenance: '维护恢复事件',
}
const actionLabels = {
  create: '系统生成报警',
  acknowledge: '确认报警',
  start_processing: '开始处理',
  submit_recovery: '提交恢复验证',
  recovery_rejected: '验证未通过，返回处理',
  maintenance_completed: '维护完成，进入恢复验证',
  production_parameter_adjusted: '生产参数调整完成',
  recovery_verification: '系统恢复验证',
  quality_reinspection_completed: '质量复检完成',
  close: '关闭报警',
}

// 首次导入静态 Mock，并同步现有生产联动报警；sourceEventId 保证刷新不重复。
alarmRecords.forEach((item) => createAlarmEvent(item, 'production_alarm'))
getLinkedAlarms().forEach((item) => createAlarmEvent(item, 'production_alarm'))
syncBusinessEventsToAlarms()

const alarms = ref(getAlarmEvents())
const level = ref('')
const status = ref('')
const keyword = ref('')
const detailVisible = ref(false)
const selected = ref(null)
const assignOwner = ref('')
const actionForm = ref({ action: '', operator: '', result: '' })
const recoveryForm = ref({ verificationType: '人工复核', description: '', verificationResult: 'passed', operator: '' })

const filtered = computed(() => alarms.value.filter((item) => {
  const text = `${item.id}${item.title}${item.equipmentName}${item.batchId}${item.processName}${item.parameterName}${item.description}`.toLowerCase()
  return (!level.value || item.level === level.value)
    && (!status.value || item.status === status.value)
    && (!keyword.value || text.includes(keyword.value.toLowerCase()))
}))
const stats = computed(() => ({
  current: alarms.value.filter((item) => !['closed', 'cancelled'].includes(item.status)).length,
  processing: alarms.value.filter((item) => ['acknowledged', 'processing', 'recovery_pending'].includes(item.status)).length,
  closed: alarms.value.filter((item) => item.status === 'closed').length,
  critical: alarms.value.filter((item) => item.level === 'critical' && !['closed', 'cancelled'].includes(item.status)).length,
}))
const trendOption = computed(() => ({ color: ['#ef5b5b', '#f1aa45', '#359fe8'], tooltip: { trigger: 'axis' }, legend: { right: 8, top: 0, textStyle: { color: '#7897ad' } }, grid: { left: 40, right: 16, top: 38, bottom: 24 }, xAxis: { type: 'category', data: alarmTrend.times, axisLine: { lineStyle: { color: '#31516a' } }, axisLabel: { color: '#7897ad' } }, yAxis: { type: 'value', minInterval: 1, axisLabel: { color: '#7897ad' }, splitLine: { lineStyle: { color: 'rgba(100,145,177,.13)', type: 'dashed' } }, }, series: [{ name: '严重', type: 'bar', stack: 'alarm', data: alarmTrend.critical }, { name: '警告', type: 'bar', stack: 'alarm', data: alarmTrend.warning }, { name: '提示', type: 'bar', stack: 'alarm', data: alarmTrend.info }] }))
const hasProductionContext = computed(() => Boolean(selected.value?.batchId || selected.value?.processName || selected.value?.parameterName))
const hasEquipmentContext = computed(() => Boolean(selected.value?.equipmentId || selected.value?.equipmentName || selected.value?.healthScore != null || selected.value?.failureProbability != null))
const hasQualityContext = computed(() => selected.value?.sourceType === 'quality_event' && Boolean(selected.value?.qualityContext))

function refreshAlarms(preferredId = selected.value?.id) {
  alarms.value = getAlarmEvents()
  if (preferredId) selected.value = alarms.value.find((item) => item.id === preferredId) || null
}
function displayValue(item) {
  if (item.currentValue === '' || item.currentValue == null) return '—'
  return `${item.currentValue}${item.unit ? ` ${item.unit}` : ''}`
}
function safeLevel(item) { return alarmLevels[item.level] || alarmLevels.warning }
function safeStatus(item) { return statusMeta[item.status] || statusMeta.new }
function openDetail(row) {
  selected.value = row
  assignOwner.value = row.owner === '未指派' ? '' : row.owner
  actionForm.value = { action: '', operator: row.owner === '未指派' ? '' : row.owner, result: '' }
  recoveryForm.value = { verificationType: '人工复核', description: '', verificationResult: 'passed', operator: row.owner === '未指派' ? '' : row.owner }
  detailVisible.value = true
}
function showFailure(result) {
  const messages = { invalid_transition: '当前报警状态不允许执行该操作', recovery_not_passed: '恢复验证未通过，不能关闭报警', not_found: '报警记录不存在' }
  ElMessage.warning(messages[result?.reason] || '操作未完成，请检查报警状态')
}
function applyResult(result, message) {
  if (!result?.updated) return showFailure(result)
  refreshAlarms(result.event.id)
  ElMessage.success(message)
}
function handleAcknowledge() {
  if (!assignOwner.value) return ElMessage.warning('请选择负责人')
  applyResult(acknowledgeAlarm(selected.value.id, assignOwner.value, assignOwner.value), '报警已确认')
}
function handleStart() {
  applyResult(startAlarmProcessing(selected.value.id, assignOwner.value || selected.value.owner || '当前用户'), '报警已进入处理流程')
}
function handleAppendAction() {
  const form = actionForm.value
  if (!form.action || !form.operator || !form.result) return ElMessage.warning('请完整填写处理措施、操作人和处理结果')
  applyResult(appendAlarmAction(selected.value.id, form.action, form.operator, form.result), '处理记录已保存')
  actionForm.value.action = ''
  actionForm.value.result = ''
}
function handleSubmitRecovery() {
  const form = recoveryForm.value
  if (!form.description || !form.operator) return ElMessage.warning('请填写验证说明和验证人员')
  const result = submitRecoveryVerification(selected.value.id, { verificationType: form.verificationType, description: form.description, verificationResult: form.verificationResult, result: form.verificationResult === 'passed' ? '恢复验证通过' : '恢复验证未通过' }, form.operator)
  applyResult(result, '恢复验证结果已提交')
}
function handleRecoveryDecision() {
  const recovery = selected.value.recovery
  if (recovery?.verificationResult === 'passed') {
    applyResult(closeAlarmEvent(selected.value.id, recovery.operator || '当前用户'), '恢复验证通过，报警已关闭')
    detailVisible.value = false
  } else {
    applyResult(returnAlarmToProcessing(selected.value.id, recovery?.operator || '当前用户', recovery?.description || '恢复验证未通过'), '验证未通过，已返回处理阶段')
  }
}

const unsubscribeLinked = subscribeLinkedAlarms((alarm) => {
  createAlarmEvent(alarm, 'production_alarm')
  refreshAlarms()
})
const handleAlarmChanged = () => refreshAlarms()
window.addEventListener(ALARM_EVENT_CHANGED, handleAlarmChanged)
onBeforeUnmount(() => {
  unsubscribeLinked()
  window.removeEventListener(ALARM_EVENT_CHANGED, handleAlarmChanged)
})
</script>

<template>
  <div class="alarm-page">
    <section class="page-header"><div><p>INDUSTRIAL ALARM MANAGEMENT</p><h2>生产异常报警中心</h2></div><span class="live"><i></i>报警闭环演示 · 基于工业仿真数据</span></section>
    <section class="top-grid">
      <div class="stats"><article><span>当前报警</span><b>{{ stats.current }}</b><el-icon><Bell /></el-icon></article><article class="red"><span>严重报警</span><b>{{ stats.critical }}</b><el-icon><WarnTriangleFilled /></el-icon></article><article class="orange"><span>处理中</span><b>{{ stats.processing }}</b><el-icon><Timer /></el-icon></article><article class="blue"><span>已关闭</span><b>{{ stats.closed }}</b><el-icon><CircleCheck /></el-icon></article></div>
      <article class="trend"><header><i></i><h3>今日报警趋势</h3></header><BaseChart :option="trendOption" height="170px" /></article>
    </section>
    <section class="table-panel">
      <header><div><i></i><h3>统一报警记录</h3><span>ALARM EVENT RECORDS</span></div><div class="filters"><el-input v-model="keyword" clearable size="small" prefix-icon="Search" placeholder="编号 / 标题 / 设备 / 批次" /><el-select v-model="level" clearable size="small" placeholder="报警等级"><el-option label="严重" value="critical" /><el-option label="警告" value="warning" /><el-option label="提示" value="info" /></el-select><el-select v-model="status" clearable size="small" placeholder="处理状态"><el-option v-for="(item, key) in statusMeta" :key="key" :label="item.label" :value="key" /></el-select></div></header>
      <el-table :data="filtered" class="alarm-table" height="430">
        <el-table-column prop="id" label="报警编号" min-width="155"><template #default="scope"><span class="alarm-id">{{ scope.row.id }}</span></template></el-table-column>
        <el-table-column prop="title" label="报警标题" min-width="190" show-overflow-tooltip />
        <el-table-column label="来源" width="110"><template #default="scope">{{ sourceLabels[scope.row.sourceType] || '工业异常报警' }}</template></el-table-column>
        <el-table-column prop="equipmentName" label="设备" min-width="135"><template #default="scope">{{ scope.row.equipmentName || '—' }}</template></el-table-column>
        <el-table-column prop="batchId" label="批次" width="145"><template #default="scope">{{ scope.row.batchId || '—' }}</template></el-table-column>
        <el-table-column prop="processName" label="工序" width="90"><template #default="scope">{{ scope.row.processName || '—' }}</template></el-table-column>
        <el-table-column prop="parameterName" label="参数" width="100"><template #default="scope">{{ scope.row.parameterName || '—' }}</template></el-table-column>
        <el-table-column label="当前值" width="105"><template #default="scope">{{ displayValue(scope.row) }}</template></el-table-column>
        <el-table-column prop="threshold" label="阈值" width="110"><template #default="scope">{{ scope.row.threshold || '—' }}</template></el-table-column>
        <el-table-column label="等级" width="75"><template #default="scope"><el-tag :type="safeLevel(scope.row).type" effect="dark" size="small">{{ safeLevel(scope.row).label }}</el-tag></template></el-table-column>
        <el-table-column label="状态" width="90"><template #default="scope"><el-tag :type="safeStatus(scope.row).type" size="small">{{ safeStatus(scope.row).label }}</el-tag></template></el-table-column>
        <el-table-column prop="owner" label="负责人" width="90" />
        <el-table-column prop="createTime" label="时间" width="165" />
        <el-table-column label="操作" width="75" fixed="right"><template #default="scope"><el-button link type="primary" @click="openDetail(scope.row)">详情</el-button></template></el-table-column>
      </el-table>
    </section>

    <el-dialog v-model="detailVisible" width="780px" title="报警详情与闭环处置">
      <template v-if="selected">
        <div class="alarm-banner" :class="selected.level"><div><small>{{ selected.id }}</small><h3>{{ selected.title }}</h3><p>{{ sourceLabels[selected.sourceType] || '工业异常报警' }} · {{ selected.createTime }}</p></div><div class="banner-tags"><el-tag :type="safeLevel(selected).type" effect="dark">{{ safeLevel(selected).label }}</el-tag><el-tag :type="safeStatus(selected).type">{{ safeStatus(selected).label }}</el-tag></div></div>

        <h4>基础信息</h4>
        <el-descriptions :column="2" border><el-descriptions-item label="报警编号">{{ selected.id }}</el-descriptions-item><el-descriptions-item label="负责人">{{ selected.owner }}</el-descriptions-item><el-descriptions-item label="来源">{{ sourceLabels[selected.sourceType] || '工业异常报警' }}</el-descriptions-item><el-descriptions-item label="更新时间">{{ selected.updateTime }}</el-descriptions-item></el-descriptions>

        <template v-if="hasProductionContext"><h4>生产上下文</h4><el-descriptions :column="2" border><el-descriptions-item v-if="selected.batchId" label="生产批次">{{ selected.batchId }}</el-descriptions-item><el-descriptions-item v-if="selected.processName" label="工序">{{ selected.processName }}</el-descriptions-item><el-descriptions-item v-if="selected.parameterName" label="参数">{{ selected.parameterName }}</el-descriptions-item><el-descriptions-item v-if="selected.currentValue !== '' && selected.currentValue != null" label="当前值">{{ displayValue(selected) }}</el-descriptions-item><el-descriptions-item v-if="selected.threshold" label="标准阈值">{{ selected.threshold }}</el-descriptions-item></el-descriptions></template>

        <template v-if="hasEquipmentContext"><h4>设备上下文</h4><el-descriptions :column="2" border><el-descriptions-item v-if="selected.equipmentId" label="设备编号">{{ selected.equipmentId }}</el-descriptions-item><el-descriptions-item v-if="selected.equipmentName" label="设备名称">{{ selected.equipmentName }}</el-descriptions-item><el-descriptions-item v-if="selected.healthScore != null" label="健康评分">{{ selected.healthScore }}</el-descriptions-item><el-descriptions-item v-if="selected.failureProbability != null" label="故障概率">{{ selected.failureProbability }}%</el-descriptions-item></el-descriptions></template>

        <template v-if="hasQualityContext"><h4>质量上下文</h4><el-descriptions :column="2" border><el-descriptions-item v-if="selected.batchId" label="生产批次">{{ selected.batchId }}</el-descriptions-item><el-descriptions-item v-if="selected.qualityContext.score != null" label="质量评分">{{ selected.qualityContext.score }}</el-descriptions-item><el-descriptions-item v-if="selected.qualityContext.level" label="质量等级">{{ selected.qualityContext.level }}</el-descriptions-item><el-descriptions-item v-if="selected.qualityContext.inspectionTaskId" label="复检任务">{{ selected.qualityContext.inspectionTaskId }}</el-descriptions-item><el-descriptions-item v-if="selected.qualityContext.abnormalItems?.length" label="异常指标" :span="2">{{ selected.qualityContext.abnormalItems.map(item => `${item.name} ${item.value}${item.unit || ''}`).join('；') }}</el-descriptions-item><template v-if="selected.qualityContext.recovery"><el-descriptions-item label="复检前结果">{{ selected.qualityContext.recovery.scoreBefore }}分 · {{ selected.qualityContext.recovery.levelBefore }}</el-descriptions-item><el-descriptions-item label="复检后结果">{{ selected.qualityContext.recovery.scoreAfter }}分 · {{ selected.qualityContext.recovery.levelAfter }}</el-descriptions-item><el-descriptions-item label="验证状态" :span="2">{{ selected.qualityContext.recovery.verificationPassed ? '质量复检已通过' : '质量复检未通过' }}</el-descriptions-item></template></el-descriptions><p class="simulation-note">质量报警规则演示 · 基于工业仿真数据</p></template>

        <h4>原因与建议</h4><div class="analysis-box"><p><b>异常描述：</b>{{ selected.description || '暂无补充描述' }}</p><p><b>原因分析：</b>{{ selected.causeAnalysis || '请结合工艺与设备状态进行人工复核' }}</p><div><b>建议措施：</b><ul v-if="selected.suggestions.length"><li v-for="item in selected.suggestions" :key="item">{{ item }}</li></ul><span v-else>请核查相关工艺参数与设备状态</span></div></div>

        <template v-if="selected.relatedEventId || selected.relatedOrderId"><h4>关联对象</h4><el-descriptions :column="2" border><el-descriptions-item v-if="selected.relatedEventId" :label="selected.sourceType === 'production_event' ? '生产事件编号' : selected.sourceType === 'equipment_event' ? '设备事件编号' : selected.sourceType === 'quality_event' ? '质量事件编号' : '关联事件'">{{ selected.relatedEventId }}</el-descriptions-item><el-descriptions-item v-if="selected.relatedOrderId" label="关联维护工单">{{ selected.relatedOrderId }}</el-descriptions-item></el-descriptions></template>

        <h4>处理时间线</h4><el-timeline class="event-timeline"><el-timeline-item v-for="(item, index) in selected.timeline" :key="`${item.time}-${index}`" :timestamp="item.time" placement="top"><b>{{ actionLabels[item.action] || item.action }}</b><span>{{ item.operator || '系统' }}</span><p v-if="item.result">{{ item.result }}</p></el-timeline-item></el-timeline>

        <div v-if="selected.status === 'new'" class="operation-box"><h4>确认报警</h4><el-select v-model="assignOwner" placeholder="选择负责人" style="width:100%"><el-option label="李工（热工）" value="李工" /><el-option label="王工（轧制）" value="王工" /><el-option label="周工（自动化）" value="周工" /><el-option label="刘工（检测）" value="刘工" /></el-select><el-button type="warning" @click="handleAcknowledge">确认报警</el-button></div>
        <div v-else-if="selected.status === 'acknowledged'" class="operation-box"><el-button type="primary" @click="handleStart">开始处理</el-button></div>
        <div v-else-if="selected.status === 'processing'" class="operation-box"><h4>处理记录</h4><el-form label-position="top"><el-form-item label="处理措施"><el-input v-model="actionForm.action" placeholder="例如：调整轧制速度" /></el-form-item><el-form-item label="操作人"><el-input v-model="actionForm.operator" /></el-form-item><el-form-item label="处理结果"><el-input v-model="actionForm.result" type="textarea" :rows="2" /></el-form-item><el-button @click="handleAppendAction">保存处理记录</el-button></el-form><h4>恢复验证（人工仿真）</h4><el-form label-position="top"><div class="form-grid"><el-form-item label="验证类型"><el-input v-model="recoveryForm.verificationType" /></el-form-item><el-form-item label="验证人员"><el-input v-model="recoveryForm.operator" /></el-form-item></div><el-form-item label="验证说明"><el-input v-model="recoveryForm.description" type="textarea" :rows="2" /></el-form-item><el-form-item label="验证结果"><el-radio-group v-model="recoveryForm.verificationResult"><el-radio value="passed">通过</el-radio><el-radio value="failed">未通过</el-radio></el-radio-group></el-form-item><el-button type="primary" @click="handleSubmitRecovery">提交恢复验证</el-button></el-form></div>
        <div v-else-if="selected.status === 'recovery_pending'" class="operation-box"><h4>恢复验证结果</h4><el-descriptions :column="2" border><el-descriptions-item label="验证类型">{{ selected.recovery?.verificationType || '人工复核' }}</el-descriptions-item><el-descriptions-item label="验证人员">{{ selected.recovery?.operator || '—' }}</el-descriptions-item><el-descriptions-item label="验证结果">{{ selected.recovery?.verificationResult === 'passed' ? '通过' : '未通过' }}</el-descriptions-item><el-descriptions-item label="验证时间">{{ selected.recovery?.time || '—' }}</el-descriptions-item><template v-if="selected.recovery?.type === 'production_parameter_adjustment'"><el-descriptions-item label="参数">{{ selected.recovery.parameterName }}</el-descriptions-item><el-descriptions-item label="调整编号">{{ selected.recovery.adjustmentId }}</el-descriptions-item><el-descriptions-item label="调整前">{{ selected.recovery.beforeValue }} {{ selected.recovery.unit }}</el-descriptions-item><el-descriptions-item label="调整后">{{ selected.recovery.afterValue }} {{ selected.recovery.unit }}</el-descriptions-item><el-descriptions-item label="标准范围" :span="2">{{ selected.recovery.standardRange }}</el-descriptions-item></template><el-descriptions-item v-if="selected.recovery?.orderId" label="维护工单">{{ selected.recovery.orderId }}</el-descriptions-item><el-descriptions-item v-if="selected.recovery?.maintenanceCompletedTime" label="维护完成时间">{{ selected.recovery.maintenanceCompletedTime }}</el-descriptions-item><el-descriptions-item v-if="selected.recovery?.beforeHealth != null" label="健康评分变化">{{ selected.recovery.beforeHealth }} → {{ selected.recovery.afterHealth }}</el-descriptions-item><el-descriptions-item v-if="selected.recovery?.beforeProbability != null" label="故障概率变化">{{ selected.recovery.beforeProbability }}% → {{ selected.recovery.afterProbability }}%</el-descriptions-item><el-descriptions-item label="验证说明" :span="2">{{ selected.recovery?.description || '—' }}</el-descriptions-item></el-descriptions><el-button :type="selected.recovery?.verificationResult === 'passed' ? 'success' : 'warning'" @click="handleRecoveryDecision">{{ selected.recovery?.verificationResult === 'passed' ? '关闭报警' : '返回继续处理' }}</el-button></div>
      </template>
      <template #footer><el-button @click="detailVisible = false">关闭窗口</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.alarm-page{color:#dcecf7}.page-header{display:flex;justify-content:space-between;align-items:center;padding:4px 2px 15px}.page-header p{margin:0 0 4px;color:#3d9ccb;font:10px Consolas;letter-spacing:2px}.page-header h2{margin:0;color:#edf8ff;font-size:21px}.live{color:#6f91a8;font-size:10px}.live i{display:inline-block;width:7px;height:7px;margin-right:7px;border-radius:50%;background:#2bd398;box-shadow:0 0 8px #2bd398}.top-grid{display:grid;grid-template-columns:1.4fr 1fr;gap:12px;margin-bottom:12px}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.stats article{position:relative;min-height:118px;padding:20px;background:linear-gradient(145deg,#0d3453,#09263e);border:1px solid #224e6c;border-top:2px solid #31c8d8}.stats span{color:#7394aa;font-size:10px}.stats b{display:block;margin-top:10px;color:#e5f4fc;font:600 30px Consolas}.stats .el-icon{position:absolute;right:16px;bottom:18px;color:#245d7d;font-size:29px}.stats .red{border-top-color:#ef5b5b}.stats .red b{color:#ef6b6b}.stats .orange{border-top-color:#f1aa45}.stats .orange b{color:#f1aa45}.stats .blue{border-top-color:#359fe8}.stats .blue b{color:#4ab0ef}.trend,.table-panel{padding:13px 15px 4px;background:linear-gradient(145deg,#0a2b46,#071f34);border:1px solid #204c6c}.trend header,.table-panel>header>div:first-child{display:flex;align-items:center;gap:8px}.trend header i,.table-panel header i{width:3px;height:15px;background:#2bb7ec}.trend h3,.table-panel h3{margin:0;color:#dceefa;font-size:13px}.table-panel{padding-bottom:14px}.table-panel>header{min-height:48px;display:flex;align-items:flex-start;justify-content:space-between;border-bottom:1px solid rgba(55,107,142,.35)}.table-panel header span{color:#49748e;font:9px Consolas}.filters{display:flex;gap:8px;width:560px}.filters .el-input{flex:1}.filters .el-select{width:125px}.alarm-table{--el-table-bg-color:#0a2942;--el-table-tr-bg-color:#0a2942;--el-table-row-hover-bg-color:#123d5b;--el-table-header-bg-color:#0d3451;--el-table-border-color:#204760;--el-table-text-color:#a9c1d0;--el-table-header-text-color:#7195ad;font-size:11px}.alarm-id{color:#43b8ed;font:11px Consolas}.alarm-banner{display:flex;justify-content:space-between;align-items:center;padding:15px 18px;margin-bottom:15px;background:#f4f7f9;border-left:4px solid #389fe0}.alarm-banner.critical{border-color:#ef5b5b}.alarm-banner.warning{border-color:#e6a23c}.alarm-banner small{color:#4585a9;font:10px Consolas}.alarm-banner h3{margin:5px 0;color:#293f51;font-size:15px}.alarm-banner p{margin:0;color:#82939f;font-size:10px}.banner-tags{display:flex;gap:8px}.alarm-page :deep(.el-dialog h4){margin:17px 0 9px;color:#354e61;font-size:13px}.analysis-box,.operation-box{padding:12px 15px;border:1px solid #d8e4eb;background:#f7fafc;color:#40596a;font-size:12px}.analysis-box p{margin:4px 0 9px}.analysis-box ul{margin:7px 0 0;padding-left:20px}.operation-box{margin-top:14px}.operation-box>.el-button{margin-top:12px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.event-timeline{max-height:240px;overflow:auto;padding-top:8px}.event-timeline span{margin-left:10px;color:#6e8797;font-size:11px}.event-timeline p{margin:5px 0;color:#526b7a;font-size:11px}@media(max-width:1150px){.top-grid{grid-template-columns:1fr}.stats article{min-height:90px}}@media(max-width:700px){.stats{grid-template-columns:repeat(2,1fr)}.table-panel>header{height:auto;flex-direction:column;gap:10px;padding-bottom:10px}.filters{width:100%}.form-grid{grid-template-columns:1fr}}
.simulation-note{margin:7px 0 0;color:#6f8796;font-size:10px}
</style>
