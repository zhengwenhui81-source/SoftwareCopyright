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
import { getProductionBatch, getProductionPlans, updateBatchProgress } from '@/productionPlan'
import { analyzeParameterStatus, getProcessParameters } from '@/processParameter'
import { closeProductionEvent, createProductionEvent, getProductionEvents, updateProductionEventStatus } from '@/productionEvent'

const processes = ref(initialProductionProcesses.map((item) => ({ ...item, parameters: item.parameters.map((p) => ({ ...p })) })))
const selectedProcess = ref(null)
const detailVisible = ref(false)
const simulationPaused = ref(false)
const productionPlans = ref(getProductionPlans())
const batch = ref(getProductionBatch(productionSummary.batchNo))
const currentPlan = computed(() => productionPlans.value.find((item) => item.id === batch.value?.planId) || productionPlans.value[0])
const abnormalCount = computed(() => processes.value.filter((item) => item.status === 'abnormal' || item.alarmDetail).length)
const currentProcess = computed(() => processes.value.find((item) => item.status === 'running' || item.status === 'abnormal'))
const overallProgress = computed(() => Math.round(processes.value.reduce((sum, item) => sum + item.progress, 0) / processes.value.length))
const parameterRecord = computed(() => getProcessParameters(batch.value?.batchId, currentProcess.value?.name))
const parameterStatuses = computed(() => analyzeParameterStatus(parameterRecord.value))
const parameterStatusMeta = {
  normal: { label: '正常', type: 'success' },
  high: { label: '偏高', type: 'danger' },
  low: { label: '偏低', type: 'warning' },
}
const productionEvents = ref([])

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
  ElMessage.info(simulationPaused.value ? '生产数据模拟已暂停' : '生产数据模拟已恢复')
}

function syncProcessAlarmStates() {
  const activeAlarms = getLinkedAlarms().filter((alarm) => alarm.batchNo === productionSummary.batchNo && !['resolved', 'closed'].includes(alarm.status))
  processes.value.forEach((process) => {
    const alarm = activeAlarms.find((item) => item.processId === process.id || item.eventKey?.split(':')[1] === process.id)
    process.alarmDetail = alarm ? {
      id: alarm.id,
      parameter: alarm.triggerParameter || '工艺参数',
      value: alarm.value || '模拟异常值',
      threshold: alarm.threshold || '模拟阈值',
    } : null
  })
}

function reportException() {
  ElMessageBox.confirm('确认将当前工序标记为异常并生成报警记录？', '异常上报', { type: 'warning' }).then(() => {
    const process = processes.value.find((item) => item.id === selectedProcess.value?.id)
    if (process) {
      process.status = 'abnormal'
      createManualProcessAlarm(process, productionSummary.batchNo)
      syncProcessAlarmStates()
    }
    ElMessage.success('异常已上报至报警中心')
  }).catch(() => {})
}

function updateProduction() {
  if (simulationPaused.value) return
  const running = processes.value.find((item) => item.status === 'running')
  if (!running) return
  running.progress = Math.min(100, running.progress + Math.floor(Math.random() * 4 + 2))
  running.parameters = running.parameters.map((parameter, index) => ({ ...parameter, value: fluctuateProcessValue(parameter.value, index === 0 ? 1.2 : .12, typeof parameter.value === 'number' && !Number.isInteger(parameter.value) ? 2 : 0) }))
  const linkedAlarms = evaluateProcessAlarms(processes.value, productionSummary.batchNo)
  syncProcessAlarmStates()
  if (linkedAlarms.length) ElMessage.warning(`检测到${linkedAlarms[0].reason}，已自动生成报警`)
  if (running.progress >= 100) {
    running.status = 'completed'
    running.duration = '已完成'
    const nextIndex = processes.value.findIndex((item) => item.id === running.id) + 1
    if (processes.value[nextIndex]) {
      processes.value[nextIndex].status = 'running'
      processes.value[nextIndex].progress = 8
      processes.value[nextIndex].duration = '进行中'
      ElMessage.success(`${processes.value[nextIndex].name}工序已开始`)
    }
  }
  batch.value = updateBatchProgress(batch.value.batchId, overallProgress.value, currentProcess.value?.name || '全部完成', currentProcess.value ? 'running' : 'completed')
}

const timer = window.setInterval(updateProduction, 3000)
evaluateProcessAlarms(processes.value, productionSummary.batchNo)
syncProcessAlarmStates()
onBeforeUnmount(() => window.clearInterval(timer))
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
              <p>标准范围：{{ item.range }}</p><em>{{ item.description }}</em>
            </article>
          </div>
          <ProcessTrendChart :batch-id="parameterRecord.batchId" :process="parameterRecord.process" :parameters="parameterStatuses" />
        </div>
      </template>
      <el-empty v-else description="当前工序暂无参数分析规则" :image-size="65" />
      <footer>工艺参数分析仅用于生产监控演示，不直接生成报警。</footer>
    </section>

    <ProductionEventTable :events="productionEvents" @confirm="confirmProductionEvent" @close="finishProductionEvent" />

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
