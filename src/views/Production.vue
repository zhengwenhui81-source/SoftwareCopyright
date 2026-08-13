<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import BatchProgress from '@/components/production/BatchProgress.vue'
import ProcessNode from '@/components/production/ProcessNode.vue'
import ProcessTrendChart from '@/components/production/ProcessTrendChart.vue'
import ProductionPlanCard from '@/components/production/ProductionPlanCard.vue'
import ProductionEventTable from '@/components/production/ProductionEventTable.vue'
import { initialProductionProcesses, productionSummary, statusMeta, fluctuateProcessValue } from '@/mock/production'
import { createManualProcessAlarm, evaluateProcessAlarms, getLinkedAlarms } from '@/industrialAlarmLink'
import { getProductionBatch, getProductionPlans, getProductionRuntime, updateBatchProgress, updateProductionRuntime } from '@/productionPlan'
import { analyzeParameterStatus, appendRuntimeParameterSample, getProcessParameters } from '@/processParameter'
import { PROCESS_PARAMETER_CHANGED, processParameterRules } from '@/processParameter'
import { closeProductionEvent, createProductionEvent, getProductionEvents, updateProductionEventStatus } from '@/productionEvent'
import { createProductionAdjustment, executeProductionAdjustment } from '@/productionAdjustment'

const productionPlans = ref(getProductionPlans())
const batch = ref(getProductionBatch(productionSummary.batchNo))
const runtimeSnapshot = getProductionRuntime(batch.value.batchId, initialProductionProcesses.map(({ id, name, status, progress }) => ({ id, name, status, progress })))
function createRuntimeProcesses() {
  return initialProductionProcesses.map((item) => {
    const status = runtimeSnapshot?.baseStatuses?.[item.id] || item.status
    const process = { ...item, status, baseStatus: status, progress: runtimeSnapshot?.processProgress?.[item.id] ?? item.progress, parameters: item.parameters.map((parameter) => ({ ...parameter })) }
    const latest = getProcessParameters(batch.value.batchId, item.name)
    Object.entries(processParameterRules[item.name] || {}).forEach(([key, rule]) => {
      const parameter = process.parameters.find((candidate) => candidate.key === key || rule.aliases.includes(candidate.name))
      if (parameter && latest?.parameters?.[key] != null) parameter.value = latest.parameters[key]
    })
    if (status === 'completed') process.duration = '已完成'
    else if (status === 'running') process.duration = '进行中'
    return process
  })
}
const processes = ref(createRuntimeProcesses())
const selectedProcess = ref(null)
const detailVisible = ref(false)
const simulationPaused = ref(Boolean(runtimeSnapshot?.simulationPaused))
const currentPlan = computed(() => productionPlans.value.find((item) => item.id === batch.value?.planId) || productionPlans.value[0])
const abnormalCount = computed(() => processes.value.filter((item) => item.status === 'abnormal' || item.runtimeAlarmState === 'current_abnormal').length)
const currentProcess = computed(() => processes.value.find((item) => item.baseStatus === 'running') || processes.value.find((item) => item.status === 'running' || item.status === 'abnormal'))
const blockedProcess = computed(() => currentProcess.value?.runtimeAlarmState === 'current_abnormal' ? currentProcess.value : null)
const blockedMessage = computed(() => blockedProcess.value
  ? `工序异常阻断：${blockedProcess.value.name}${blockedProcess.value.alarmDetail?.parameter || '工艺参数'}超出仿真范围，自动推进已暂停，请完成参数调整。`
  : '')
const overallProgress = computed(() => Math.round(processes.value.reduce((sum, item) => sum + item.progress, 0) / processes.value.length))
const parameterRevision = ref(0)
const parameterRecord = computed(() => { parameterRevision.value; return getProcessParameters(batch.value?.batchId, currentProcess.value?.name) })
const parameterStatuses = computed(() => analyzeParameterStatus(parameterRecord.value))
const parameterStatusMeta = {
  normal: { label: '正常', type: 'success' },
  high: { label: '偏高', type: 'danger' },
  low: { label: '偏低', type: 'warning' },
}
const productionEvents = ref([])
const adjustmentVisible = ref(false)
const adjustmentForm = ref({ parameterKey: '', parameterName: '', currentValue: 0, targetValue: 0, unit: '', lowerLimit: 0, upperLimit: 0, operator: '张工', reason: '' })

function refreshProductionEvents() {
  productionEvents.value = getProductionEvents().filter((item) => item.batchId === batch.value?.batchId)
}

function syncProductionEvents() {
  if (!parameterRecord.value) return refreshProductionEvents()
  parameterStatuses.value.filter((item) => item.status !== '正常').forEach((item) => {
    createProductionEvent({
      batchId: parameterRecord.value.batchId, steelGrade: currentPlan.value?.steelGrade, process: parameterRecord.value.process,
      parameterKey: item.key, parameter: item.name, currentValue: item.value, unit: item.unit, threshold: item.range,
      parameterStatus: item.status, level: 'warning', title: `${parameterRecord.value.process}${item.name}${item.status}`,
      description: item.description,
      suggestion: [`复核${item.name}工艺设定`, '确认当前工序设备运行状态', '持续观察参数变化趋势'],
    })
  })
  refreshProductionEvents()
}

function confirmProductionEvent(eventId) {
  const result = updateProductionEventStatus(eventId, 'processing')
  if (!result.updated) return ElMessage.error('生产异常事件状态更新失败')
  refreshProductionEvents()
  ElMessage.success('生产异常事件已确认，进入处理中')
}

function finishProductionEvent(eventId) {
  const result = closeProductionEvent(eventId)
  if (!result.closed) return ElMessage.error('事件必须确认后才能关闭')
  refreshProductionEvents()
  ElMessage.success('生产异常事件已关闭')
}

watch(parameterStatuses, syncProductionEvents, { immediate: true })

function openDetail(process) {
  selectedProcess.value = process
  detailVisible.value = true
}

function toggleSimulation() {
  simulationPaused.value = !simulationPaused.value
  batch.value = updateBatchProgress(batch.value.batchId, overallProgress.value, currentProcess.value?.name || '全部完成', simulationPaused.value ? 'paused' : 'running')
  persistRuntime(true)
  ElMessage.info(simulationPaused.value ? '生产数据模拟已暂停' : '生产数据模拟已恢复')
}

let lastRuntimeSave = 0
function persistRuntime(force = false) {
  const now = Date.now()
  if (!force && now - lastRuntimeSave < 12000) return
  const runningIndex = processes.value.findIndex((item) => item.baseStatus === 'running')
  updateProductionRuntime(batch.value.batchId, {
    currentProcessId: runningIndex >= 0 ? processes.value[runningIndex].id : '', currentProcessIndex: runningIndex,
    processProgress: Object.fromEntries(processes.value.map((item) => [item.id, item.progress])),
    baseStatuses: Object.fromEntries(processes.value.map((item) => [item.id, item.baseStatus || item.status])),
    simulationPaused: simulationPaused.value,
  })
  lastRuntimeSave = now
}

function syncProcessAlarmStates() {
  const activeAlarms = getLinkedAlarms().filter((alarm) => alarm.batchNo === productionSummary.batchNo && alarm.status !== 'closed')
  const severityRank = { critical: 4, high: 3, warning: 2, info: 1 }
  processes.value.forEach((process) => {
    const processAlarms = activeAlarms.filter((item) => item.processId === process.id || item.eventKey?.split(':')[1] === process.id)
    const manualAlarm = processAlarms.find((item) => item.source === 'production-manual')
    const latestRecord = getProcessParameters(batch.value?.batchId, process.name)
    const assessments = Object.entries(processParameterRules[process.name] || {}).flatMap(([key, rule]) => {
      const visibleParameter = process.parameters.find((item) => item.key === key || rule.aliases.includes(item.name))
      const latestValue = latestRecord?.parameters?.[key]
      const parameter = visibleParameter || (latestValue != null ? { key, name: rule.parameterName, value: latestValue, unit: rule.unit } : null)
      const value = Number(parameter?.value)
      if (!parameter || !Number.isFinite(value)) return []
      const outside = value < rule.min || value > rule.max
      const span = Math.max(Math.abs(rule.max - rule.min), 1)
      const deviation = outside ? (value < rule.min ? rule.min - value : value - rule.max) / span : 0
      const alarm = processAlarms.find((item) => item.parameterKey === key)
        || processAlarms.find((item) => !item.parameterKey && rule.aliases.includes(item.triggerParameter))
      return [{ key, rule, parameter, value, outside, deviation, alarm }]
    })
    const currentAbnormalDetails = assessments.filter((item) => item.outside).sort((a, b) => {
      const severityDifference = (severityRank[b.alarm?.level || b.rule.alarmLevel] || 0) - (severityRank[a.alarm?.level || a.rule.alarmLevel] || 0)
      return severityDifference || b.deviation - a.deviation
    })
    const recoveryPendingDetails = assessments.filter((item) => !item.outside && item.alarm).sort((a, b) => {
      const severityDifference = (severityRank[b.alarm.level] || 0) - (severityRank[a.alarm.level] || 0)
      return severityDifference || new Date(b.alarm.time || b.alarm.createTime || 0) - new Date(a.alarm.time || a.alarm.createTime || 0)
    })
    const buildDetail = (item) => ({
      id: item.alarm?.id || '', parameterKey: item.key, parameter: item.rule.parameterName,
      value: item.alarm?.value || `${item.parameter.value} ${item.parameter.unit}`.trim(),
      threshold: item.alarm?.threshold || `${item.rule.min}–${item.rule.max} ${item.rule.unit}`,
      currentValue: `${item.parameter.value} ${item.parameter.unit}`.trim(), alarmStatus: item.alarm?.status || 'pending',
      currentOutside: item.outside, level: item.alarm?.level || item.rule.alarmLevel || 'info', deviation: item.deviation,
    })
    const manualDetail = manualAlarm ? { id: manualAlarm.id, parameterKey: manualAlarm.parameterKey || '', parameter: manualAlarm.triggerParameter || '人工判定', value: manualAlarm.value || '人工异常', threshold: manualAlarm.threshold || '人工判定', currentValue: manualAlarm.value || '', alarmStatus: manualAlarm.status, currentOutside: Boolean(process.manualException), level: manualAlarm.level || 'warning' } : null
    const manualAlreadyMatched = assessments.some((item) => item.alarm?.id === manualAlarm?.id)
    process.alarmDetails = [...assessments.filter((item) => item.alarm || item.outside).map(buildDetail), ...(manualDetail && !manualAlreadyMatched ? [manualDetail] : [])]
    if (currentAbnormalDetails.length) {
      process.runtimeAlarmState = 'current_abnormal'
      process.alarmDetail = buildDetail(currentAbnormalDetails[0])
    } else if (process.manualException) {
      process.runtimeAlarmState = 'current_abnormal'
      process.alarmDetail = manualDetail
    } else if (recoveryPendingDetails.length || manualDetail) {
      process.runtimeAlarmState = 'recovery_pending'
      process.alarmDetail = recoveryPendingDetails.length ? buildDetail(recoveryPendingDetails[0]) : manualDetail
    } else {
      process.runtimeAlarmState = null
      process.alarmDetail = null
    }
  })
}

function reportException() {
  ElMessageBox.confirm('确认将当前工序标记为异常并生成报警记录？', '异常上报', { type: 'warning' }).then(() => {
    const process = processes.value.find((item) => item.id === selectedProcess.value?.id)
    if (process) {
      process.status = 'abnormal'
      process.manualException = true
      createManualProcessAlarm(process, productionSummary.batchNo)
      syncProcessAlarmStates()
    }
    ElMessage.success('异常已上报至报警中心')
  }).catch(() => {})
}

function openAdjustment(item) {
  adjustmentForm.value = {
    parameterKey: item.key, parameterName: item.name, currentValue: item.value,
    targetValue: Number(((item.min + item.max) / 2).toFixed(Math.abs(item.max) < 100 ? 2 : 0)),
    unit: item.unit, lowerLimit: item.min, upperLimit: item.max, operator: '张工',
    reason: `${currentProcess.value?.name}${item.name}${item.status}，执行模拟工艺参数调整`,
  }
  adjustmentVisible.value = true
}

function executeAdjustment() {
  const form = adjustmentForm.value
  const target = Number(form.targetValue)
  if (!Number.isFinite(target) || target < form.lowerLimit || target > form.upperLimit) return ElMessage.warning('目标参数仍超出工艺标准范围')
  if (!form.operator.trim() || !form.reason.trim()) return ElMessage.warning('请填写执行人员和调整原因')
  const created = createProductionAdjustment({
    batchId: batch.value.batchId, process: currentProcess.value.name, processId: currentProcess.value.id,
    parameterKey: form.parameterKey, parameterName: form.parameterName, targetValue: target,
    operator: form.operator.trim(), reason: form.reason.trim(),
  })
  if (!created.created) return ElMessage.error('无法创建参数调整记录')
  const result = executeProductionAdjustment(created.adjustment.id)
  if (!result.executed) return ElMessage.warning(result.reason === 'target_out_of_range' ? '目标参数仍超出工艺标准范围' : '参数调整执行失败')
  adjustmentVisible.value = false
  refreshProductionEvents()
  if (!result.productionEventResult.updated) {
    ElMessage.warning(`参数调整完成：${result.adjustment.beforeValue} ${form.unit} → ${result.adjustment.actualValue} ${form.unit}，但未找到对应生产异常事件`)
  } else if (!result.alarmResult.updated) {
    ElMessage.warning(`参数调整完成，生产事件已进入恢复验证，但未找到可反馈的统一报警`)
  } else {
    ElMessage.success(`参数调整完成：${result.adjustment.beforeValue} ${form.unit} → ${result.adjustment.actualValue} ${form.unit}；生产事件与统一报警已进入恢复验证`)
  }
}

function handleParameterChanged(event) {
  const detail = event.detail || {}
  parameterRevision.value += 1
  const process = processes.value.find((item) => item.name === detail.process)
  if (!process) return
  const aliases = { 炉温: '加热温度', 表面质量等级: '表面质量', 板厚: '厚度控制' }
  if (detail.source === 'simulation' && detail.parameters) {
    Object.entries(processParameterRules[detail.process] || {}).forEach(([key, runtimeRule]) => {
      const runtimeParameter = process.parameters.find((item) => item.key === key || runtimeRule.aliases.includes(item.name) || item.name === aliases[runtimeRule.name])
      if (runtimeParameter && detail.parameters[key] != null) runtimeParameter.value = detail.parameters[key]
    })
    if (process.baseStatus === 'running') evaluateProcessAlarms([process], productionSummary.batchNo)
    syncProcessAlarmStates()
    return
  }
  const rule = processParameterRules[detail.process]?.[detail.parameterKey]
  if (!rule) return
  const parameter = process.parameters.find((item) => item.name === rule.name || item.name === aliases[rule.name])
  const nextValue = detail.value ?? detail.parameters?.[detail.parameterKey]
  if (parameter && nextValue != null) parameter.value = nextValue
  if (detail.source === 'adjustment') process.adjustedParameters = [...new Set([...(process.adjustedParameters || []), parameter?.name || rule.name])]
  const latest = getProcessParameters(detail.batchId, detail.process)
  const allNormal = analyzeParameterStatus(latest).every((item) => item.status === '正常')
  if (allNormal && !process.manualException) {
    if (process.status === 'abnormal') process.status = 'running'
    process.alarmDetail = null
  }
  if (process.baseStatus === 'running') evaluateProcessAlarms([process], productionSummary.batchNo)
  syncProcessAlarmStates()
}

window.addEventListener(PROCESS_PARAMETER_CHANGED, handleParameterChanged)

function updateProduction() {
  if (simulationPaused.value) return
  const running = processes.value.find((item) => item.baseStatus === 'running')
  if (!running) return
  syncProcessAlarmStates()
  if (running.runtimeAlarmState === 'current_abnormal') {
    persistRuntime(true)
    return
  }
  const runtimeAmplitudes = { furnaceTemperature: 4, heatingTime: 1, rollingForce: 180, rollingSpeed: .08, rollingPressure: 180, thickness: .04, coolingRate: .35, finishCoolingTemperature: 4, thicknessDeviation: .04, surfaceQuality: 0 }
  running.parameters = running.parameters.map((parameter) => {
    const ruleEntry = Object.entries(processParameterRules[running.name] || {}).find(([, rule]) => rule.aliases.includes(parameter.name))
    const amplitude = ruleEntry ? runtimeAmplitudes[ruleEntry[0]] ?? .12 : .12
    return { ...parameter, value: fluctuateProcessValue(parameter.value, amplitude, typeof parameter.value === 'number' && !Number.isInteger(parameter.value) ? 2 : 0) }
  })
  const rules = processParameterRules[running.name] || {}
  const runtimeParameters = Object.fromEntries(Object.entries(rules).flatMap(([key, rule]) => {
    const parameter = running.parameters.find((item) => item.key === key || rule.aliases.includes(item.name))
    return parameter && Number.isFinite(Number(parameter.value)) ? [[key, Number(parameter.value)]] : []
  }))
  if (Object.keys(runtimeParameters).length) appendRuntimeParameterSample({ batchId: batch.value.batchId, process: running.name, processId: running.id, parameters: runtimeParameters, source: 'simulation' })
  const linkedAlarms = evaluateProcessAlarms([running], productionSummary.batchNo)
  syncProcessAlarmStates()
  if (linkedAlarms.length) ElMessage.warning(`检测到${linkedAlarms[0].reason}，已自动生成报警`)
  if (running.runtimeAlarmState === 'current_abnormal') {
    persistRuntime(true)
    return
  }
  running.progress = Math.min(100, running.progress + Math.floor(Math.random() * 4 + 2))
  if (running.progress >= 100) {
    running.status = 'completed'
    running.baseStatus = 'completed'
    running.duration = '已完成'
    const nextIndex = processes.value.findIndex((item) => item.id === running.id) + 1
    if (processes.value[nextIndex]) {
      processes.value[nextIndex].status = 'running'
      processes.value[nextIndex].baseStatus = 'running'
      processes.value[nextIndex].progress = 8
      processes.value[nextIndex].duration = '进行中'
      ElMessage.success(`${processes.value[nextIndex].name}工序已开始`)
    }
    syncProcessAlarmStates()
    persistRuntime(true)
  }
  batch.value = updateBatchProgress(batch.value.batchId, overallProgress.value, currentProcess.value?.name || '全部完成', currentProcess.value ? 'running' : 'completed')
  persistRuntime()
}

const timer = window.setInterval(updateProduction, 3000)
if (currentProcess.value) evaluateProcessAlarms([currentProcess.value], productionSummary.batchNo)
syncProcessAlarmStates()
onBeforeUnmount(() => {
  persistRuntime(true)
  window.clearInterval(timer)
  window.removeEventListener(PROCESS_PARAMETER_CHANGED, handleParameterChanged)
})
</script>

<template>
  <div class="production-page">
    <section class="page-header">
      <div><p>THICK PLATE PRODUCTION DIGITAL TWIN</p><h2>厚板生产全过程可视化监控</h2></div>
      <div class="header-actions"><span><i></i>模拟数据运行</span><el-button type="primary" plain size="small" @click="toggleSimulation">{{ simulationPaused ? '恢复模拟' : '暂停模拟' }}</el-button></div>
    </section>

    <ProductionPlanCard v-if="currentPlan" :plan="currentPlan" class="production-plan" />
    <BatchProgress v-if="batch" :batch="batch" :processes="processes" class="batch-progress" />

    <section class="status-strip">
      <div><span>当前工序</span><strong>{{ currentProcess?.name || '全部完成' }}</strong></div>
      <div><span>正常节点</span><strong class="success">{{ processes.length - abnormalCount }}</strong></div>
      <div><span>异常节点</span><strong :class="{ danger: abnormalCount }">{{ abnormalCount }}</strong></div>
      <div><span>生产节拍</span><strong>4.8 <small>min/块</small></strong></div>
      <div><span>产线状态</span><strong class="success">稳定</strong></div>
    </section>

    <section class="flow-panel">
      <header><div><i></i><h3>生产工艺流程</h3><span>PROCESS FLOW MONITORING</span></div><div class="legend"><span><i class="done"></i>已完成</span><span><i class="active"></i>运行中</span><span><i class="wait"></i>待运行</span><span><i class="error"></i>异常</span></div></header>
      <el-alert v-if="blockedProcess" :title="blockedMessage" type="error" :closable="false" show-icon />
      <div class="process-grid"><ProcessNode v-for="(process,index) in processes" :key="process.id" :process="process" :index="index" :last="index === processes.length - 1" @select="openDetail" /></div>
    </section>

    <section class="parameter-panel">
      <header><div><i></i><h3>工艺参数监控</h3><span>PROCESS PARAMETER ANALYSIS</span></div><div class="parameter-process">当前生产工序 <b>{{ currentProcess?.name || '全部完成' }}</b><small>{{ batch?.batchId }}</small></div></header>
      <template v-if="parameterRecord && parameterStatuses.length">
        <div class="parameter-analysis">
          <div class="parameter-cards">
            <article v-for="item in parameterStatuses" :key="item.key" :class="`level-${item.level}`">
              <div><span>{{ item.name }}</span><el-tag :type="parameterStatusMeta[item.level].type" size="small">{{ parameterStatusMeta[item.level].label }}</el-tag></div>
              <strong>{{ item.value }}<small>{{ item.unit }}</small></strong>
              <p>标准范围：{{ item.range }}</p><em>{{ item.description }}</em><el-button v-if="item.level !== 'normal'" type="warning" link size="small" @click="openAdjustment(item)">执行参数调整</el-button>
            </article>
          </div>
          <ProcessTrendChart :batch-id="parameterRecord.batchId" :process="parameterRecord.process" :parameters="parameterStatuses" />
        </div>
      </template>
      <el-empty v-else description="当前工序暂无参数分析规则" :image-size="65" />
      <footer>工艺参数分析仅用于生产监控演示，不直接生成报警。</footer>
    </section>

    <ProductionEventTable :events="productionEvents" @confirm="confirmProductionEvent" @close="finishProductionEvent" />

    <el-dialog v-model="adjustmentVisible" width="560px" title="生产工艺参数调整">
      <el-alert title="工艺调整演示 · 基于工业仿真数据" type="info" :closable="false" show-icon />
      <el-descriptions :column="2" border class="adjustment-summary"><el-descriptions-item label="生产批次">{{ batch?.batchId }}</el-descriptions-item><el-descriptions-item label="工序">{{ currentProcess?.name }}</el-descriptions-item><el-descriptions-item label="参数">{{ adjustmentForm.parameterName }}</el-descriptions-item><el-descriptions-item label="当前值">{{ adjustmentForm.currentValue }} {{ adjustmentForm.unit }}</el-descriptions-item><el-descriptions-item label="标准范围" :span="2">{{ adjustmentForm.lowerLimit }}–{{ adjustmentForm.upperLimit }} {{ adjustmentForm.unit }}</el-descriptions-item></el-descriptions>
      <el-form label-position="top"><el-form-item label="目标值"><el-input-number v-model="adjustmentForm.targetValue" :precision="Math.abs(adjustmentForm.upperLimit) < 100 ? 2 : 0" :step="Math.abs(adjustmentForm.upperLimit) < 100 ? 0.1 : 100" style="width:100%" /></el-form-item><el-form-item label="执行人员"><el-input v-model="adjustmentForm.operator" /></el-form-item><el-form-item label="调整原因"><el-input v-model="adjustmentForm.reason" type="textarea" :rows="3" /></el-form-item></el-form>
      <template #footer><el-button @click="adjustmentVisible=false">取消</el-button><el-button type="primary" @click="executeAdjustment">执行参数调整</el-button></template>
    </el-dialog>

    <el-dialog v-model="detailVisible" width="620px" class="process-dialog" destroy-on-close>
      <template #header><div class="dialog-title"><span class="dialog-icon"><el-icon><Operation /></el-icon></span><div><small>PROCESS DETAIL</small><h3>{{ selectedProcess?.name }}</h3></div><el-tag v-if="selectedProcess" :type="statusMeta[selectedProcess.status].type" effect="dark">{{ statusMeta[selectedProcess.status].label }}</el-tag></div></template>
      <template v-if="selectedProcess">
        <el-descriptions :column="2" border><el-descriptions-item label="设备名称">{{ selectedProcess.equipment }}</el-descriptions-item><el-descriptions-item label="负责人员">{{ selectedProcess.operator }}</el-descriptions-item><el-descriptions-item label="运行时长">{{ selectedProcess.duration }}</el-descriptions-item><el-descriptions-item label="完成进度">{{ selectedProcess.progress }}%</el-descriptions-item></el-descriptions>
        <h4 class="section-title">实时工艺参数</h4>
        <div class="parameter-grid"><div v-for="parameter in selectedProcess.parameters" :key="parameter.name"><span>{{ parameter.name }}</span><strong>{{ parameter.value }}<small>{{ parameter.unit }}</small></strong><em>控制范围：{{ parameter.range }}</em></div></div>
        <h4 class="section-title">工序说明</h4><p class="description">{{ selectedProcess.description }}</p>
      </template>
      <template #footer><el-button @click="detailVisible=false">关闭</el-button><el-button type="danger" plain :disabled="selectedProcess?.status === 'waiting'" @click="reportException">异常上报</el-button><el-button type="primary" @click="ElMessage.success('工序参数已确认')">参数确认</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.production-page{color:#d9eaf6}.production-plan,.batch-progress{margin-bottom:12px}.page-header{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:4px 2px 15px}.page-header p{margin:0 0 4px;color:#3b9acb;font:10px Consolas;letter-spacing:2px}.page-header h2{margin:0;color:#edf8ff;font-size:21px}.header-actions{display:flex;align-items:center;gap:15px}.header-actions>span{color:#7899b1;font-size:11px}.header-actions>span i{display:inline-block;width:7px;height:7px;margin-right:7px;border-radius:50%;background:#29d394;box-shadow:0 0 8px #29d394}.status-strip{display:grid;grid-template-columns:repeat(5,1fr);margin-bottom:12px;background:#092840;border:1px solid #1e4865}.status-strip>div{display:flex;align-items:center;justify-content:center;gap:14px;min-height:58px;border-right:1px solid #1e4865}.status-strip>div:last-child{border:0}.status-strip span{color:#698aa2;font-size:11px}.status-strip strong{color:#dbeaf3;font:600 17px Consolas,"Microsoft YaHei"}.status-strip small{font-size:10px;color:#6d91a9}.success{color:#2dd298!important}.danger{color:#ff6262!important}.flow-panel{padding:16px 18px 22px;background:linear-gradient(145deg,#0a2b46,#071f34);border:1px solid #204c6c}.flow-panel>header{display:flex;align-items:center;justify-content:space-between;padding-bottom:14px;border-bottom:1px solid rgba(55,107,142,.35)}.flow-panel>header>div{display:flex;align-items:center;gap:9px}.flow-panel>header>div>i{width:3px;height:16px;background:#2cb9ed;box-shadow:0 0 8px #2cb9ed}.flow-panel h3{margin:0;color:#dceefa;font-size:14px}.flow-panel header>div>span{color:#3f6d89;font:9px Consolas;letter-spacing:1px}.legend span{display:flex;align-items:center;gap:5px!important;color:#6f91aa!important;font:10px "Microsoft YaHei"!important;letter-spacing:0!important}.legend i{width:7px!important;height:7px!important;border-radius:50%;box-shadow:none!important}.done{background:#29c88d!important}.active{background:#2cbee9!important}.wait{background:#607b8e!important}.error{background:#ec5959!important}.process-grid{display:grid;grid-template-columns:repeat(8,minmax(140px,1fr));gap:18px;padding-top:22px}.parameter-panel{margin-top:12px;padding:0 16px 10px;background:linear-gradient(145deg,#0a2b46,#071f34);border:1px solid #204c6c}.parameter-panel>header{display:flex;align-items:center;justify-content:space-between;height:47px;border-bottom:1px solid rgba(55,107,142,.35)}.parameter-panel>header>div:first-child{display:flex;align-items:center;gap:8px}.parameter-panel header i{width:3px;height:16px;background:#2cb9ed}.parameter-panel h3{margin:0;font-size:14px}.parameter-panel header span{color:#49748e;font:9px Consolas}.parameter-process{color:#6d8fa5;font-size:10px}.parameter-process b{margin:0 8px;color:#4cc4ef;font-size:13px}.parameter-process small{color:#4d7289;font:9px Consolas}.parameter-analysis{display:grid;grid-template-columns:360px 1fr;gap:12px;padding-top:12px}.parameter-cards{display:grid;gap:10px}.parameter-cards article{padding:13px 15px;background:#09263e;border-left:3px solid #2bd398}.parameter-cards article.level-high{border-color:#ef6262}.parameter-cards article.level-low{border-color:#ffad45}.parameter-cards article>div{display:flex;align-items:center;justify-content:space-between}.parameter-cards span{color:#80a1b5;font-size:11px}.parameter-cards strong{display:block;margin-top:7px;color:#dcecf7;font:600 24px Consolas}.parameter-cards strong small{margin-left:4px;color:#6d91a8;font-size:10px}.parameter-cards p{margin:5px 0;color:#66899f;font-size:9px}.parameter-cards em{color:#50768d;font-size:9px;font-style:normal}.parameter-panel>footer{margin-top:8px;color:#496e84;text-align:right;font-size:8px}.dialog-title{display:flex;align-items:center;gap:12px}.dialog-title>div{flex:1}.dialog-title small{color:#5999bf;font:9px Consolas;letter-spacing:2px}.dialog-title h3{margin:3px 0 0;color:#243a50;font-size:18px}.dialog-icon{width:38px;height:38px;display:grid;place-items:center;color:#fff;background:#238ed0;border-radius:4px;font-size:20px}.section-title{margin:20px 0 10px;padding-left:9px;color:#314b61;font-size:13px;border-left:3px solid #2699d6}.parameter-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.parameter-grid>div{display:flex;flex-direction:column;padding:13px;background:#f2f7fa;border:1px solid #dce8ef}.parameter-grid span{color:#6e8291;font-size:11px}.parameter-grid strong{margin:5px 0;color:#166fa5;font:600 22px Consolas}.parameter-grid small{margin-left:4px;font:11px "Microsoft YaHei"}.parameter-grid em{color:#99a7b1;font-size:9px;font-style:normal}.description{margin:0;padding:12px;color:#5c7182;font-size:12px;line-height:1.7;background:#f6f8fa}.process-dialog :deep(.el-dialog__body){padding-top:10px}@media(max-width:1500px){.process-grid{grid-template-columns:repeat(4,1fr)}}@media(max-width:900px){.process-grid{grid-template-columns:repeat(2,1fr)}.status-strip{grid-template-columns:repeat(2,1fr)}.parameter-analysis{grid-template-columns:1fr}.page-header,.flow-panel>header{align-items:flex-start;flex-direction:column}}
</style>
